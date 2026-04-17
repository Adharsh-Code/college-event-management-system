const express = require("express");
require("dotenv").config();
const http = require("http");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { Server } = require("socket.io");

const User = require("./models/User");
const Event = require("./models/Event");
const Venue = require("./models/Venue");
const Certificate = require("./models/Certificate");
const EventResult = require("./models/EventResult");
const Feedback = require("./models/Feedback");
const Report = require("./models/Report"); 
const Conversation = require("./models/Conversation");
const Message = require("./models/Message");
const { verifyToken, requireAdmin } = require("./middleware/auth");

const app = express();
const server = http.createServer(app);
const PORT = Number(process.env.PORT) || 3001;
const JWT_SECRET = process.env.JWT_SECRET;
const MONGODB_URI = process.env.MONGODB_URI;
const uploadsDir = path.join(__dirname, "uploads");

if (!JWT_SECRET) {
  throw new Error("Missing JWT_SECRET. Add it to Server/.env before starting the server.");
}

if (!MONGODB_URI) {
  throw new Error("Missing MONGODB_URI. Add it to Server/.env before starting the server.");
}

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

const generateCertificateNumber = (eventId, participantId) => {
  const eventPart = String(eventId || "").slice(-6).toUpperCase();
  const participantPart = String(participantId || "").slice(-6).toUpperCase();
  return `CEM-${eventPart}-${participantPart}-${Date.now()}`;
};

const generateCheckInToken = (eventId, participantId) => {
  const eventPart = String(eventId || "").slice(-4).toUpperCase();
  const participantPart = String(participantId || "").slice(-4).toUpperCase();
  const randomPart = crypto.randomBytes(12).toString("hex").toUpperCase();
  return `CEMCHK-${eventPart}-${participantPart}-${randomPart}`;
};

const normalizeVenueName = (value = "") =>
  value
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();

const escapeRegex = (value = "") =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const parseBooleanInput = (value, fallback = false) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }
  return fallback;
};

const normalizeEventMode = (value) =>
  String(value || "standard").trim().toLowerCase() === "ranking" ? "ranking" : "standard";

const isRankingEvent = (event) => normalizeEventMode(event?.eventMode) === "ranking";

const getRankingOrder = (event) =>
  String(event?.rankingConfig?.rankingOrder || "higher").trim().toLowerCase() === "lower"
    ? "lower"
    : "higher";

const getNormalizedRankValue = (value) => {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsedValue = Number(value);
  return Number.isInteger(parsedValue) && parsedValue > 0 ? parsedValue : null;
};

const getAchievementTitleForRank = (rank) => {
  return rank ? `Rank ${rank}` : "";
};

const migrateLegacyCertificates = async () => {
  await Certificate.updateMany(
    {
      $or: [
        { certificateType: { $exists: false } },
        { certificateType: null },
        { certificateType: "" },
      ],
    },
    {
      $set: {
        certificateType: "participation",
        resultId: null,
        rank: null,
        achievementTitle: "",
      },
    }
  );
};

const normalizeRankingConfigInput = (body = {}) => {
  const eventMode = normalizeEventMode(body.eventMode);
  const rankingOrder =
    String(body.rankingOrder || "higher").trim().toLowerCase() === "lower"
      ? "lower"
      : "higher";

  return {
    eventMode,
    rankingConfig:
      eventMode === "ranking"
        ? {
            metricLabel: String(body.metricLabel || "").trim(),
            metricUnit: String(body.metricUnit || "").trim(),
            rankingOrder,
            resultsPublished: parseBooleanInput(body.resultsPublished, false),
          }
        : {
            metricLabel: "",
            metricUnit: "",
            rankingOrder: "higher",
            resultsPublished: false,
          },
  };
};

const syncVenueCatalogFromEvents = async () => {
  const eventVenues = await Event.distinct("venue", {
    venue: { $type: "string", $ne: "" },
  });

  const operations = eventVenues
    .map((venueName) => venueName.trim().replace(/\s+/g, " "))
    .filter(Boolean)
    .map((venueName) => ({
      updateOne: {
        filter: { normalizedName: normalizeVenueName(venueName) },
        update: {
          $setOnInsert: {
            name: venueName,
            normalizedName: normalizeVenueName(venueName),
          },
        },
        upsert: true,
      },
    }));

  if (operations.length > 0) {
    await Venue.bulkWrite(operations, { ordered: false });
  }
};

const markAttendeePresent = (attendee, actorId, method) => {
  attendee.status = "present";
  attendee.checkedInAt = new Date();
  attendee.checkedInBy = actorId;
  attendee.checkInMethod = method;
};

const resetAttendeeCheckIn = (attendee) => {
  attendee.checkedInAt = null;
  attendee.checkedInBy = null;
  attendee.checkInMethod = null;
};

const normalizeRankingAssignments = (event) => {
  if (!event?.attendees?.length) {
    return false;
  }

  let changed = false;

  if (!isRankingEvent(event)) {
    (event.attendees || []).forEach((attendee) => {
      if (attendee.rank !== null && attendee.rank !== undefined) {
        attendee.rank = null;
        changed = true;
      }
    });
    return changed;
  }

  const attendeeLimit = Math.max(1, (event.attendees || []).length);
  const usedRanks = new Set();

  (event.attendees || []).forEach((attendee) => {
    const normalizedRank = getNormalizedRankValue(attendee.rank);
    const shouldClearRank =
      attendee.status !== "present" ||
      attendee.isDisqualified ||
      normalizedRank === null ||
      normalizedRank > attendeeLimit ||
      usedRanks.has(normalizedRank);

    if (shouldClearRank) {
      if (attendee.rank !== null && attendee.rank !== undefined) {
        attendee.rank = null;
        changed = true;
      }
      return;
    }

    usedRanks.add(normalizedRank);

    if (attendee.rank !== normalizedRank) {
      attendee.rank = normalizedRank;
      changed = true;
    }
  });

  return changed;
};

const buildPublishedLeaderboard = (event) => {
  if (!isRankingEvent(event) || !event?.rankingConfig?.resultsPublished) {
    return [];
  }

  return (event.attendees || [])
    .filter((attendee) => attendee.rank !== null && attendee.rank !== undefined)
    .map((attendee) => {
      const participant = attendee.user && typeof attendee.user === "object" ? attendee.user : null;
      return {
        attendeeId: attendee._id,
        participantId: participant?._id || attendee.user || null,
        name: participant?.fullName || participant?.username || "Participant",
        department: participant?.department || "",
        year: participant?.year ?? null,
        rank: attendee.rank,
        resultNote: attendee.resultNote || "",
        isDisqualified: Boolean(attendee.isDisqualified),
      };
    })
    .sort((left, right) => {
      if (left.rank !== right.rank) {
        return left.rank - right.rank;
      }
      return String(left.name || "").localeCompare(String(right.name || ""));
    });
};

const EVENT_PASS_RETENTION_MS = 24 * 60 * 60 * 1000;

const ensureAttendeeCheckInToken = (attendee, eventId) => {
  if (attendee.checkInToken) {
    return false;
  }

  attendee.checkInToken = generateCheckInToken(eventId, attendee.user?._id || attendee.user);
  return true;
};

const getAttendeeUserId = (attendee) => {
  const userId = attendee?.user?._id || attendee?.user;
  return userId ? String(userId) : "";
};

const ensureEventAttendeeTokens = (event, participantId = null) => {
  let changed = false;
  const referenceDate = new Date();

  (event.attendees || []).forEach((attendee) => {
    if (participantId && getAttendeeUserId(attendee) !== String(participantId)) {
      return;
    }

    if (clearExpiredEventPass(attendee, event, referenceDate)) {
      changed = true;
      return;
    }

    if (ensureAttendeeCheckInToken(attendee, event._id)) {
      changed = true;
    }
  });

  return changed;
};

const getEventEndDate = (event) => {
  const value = event?.endDate || event?.date;
  const parsedDate = new Date(value);
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
};

const getEventPassExpiryDate = (event) => {
  const rawEndDate = event?.endedAt || getEventEndDate(event);
  if (!rawEndDate) {
    return null;
  }

  const endDate = new Date(rawEndDate);
  if (Number.isNaN(endDate.getTime())) {
    return null;
  }

  return new Date(endDate.getTime() + EVENT_PASS_RETENTION_MS);
};

const hasEventPassExpired = (event, referenceDate = new Date()) => {
  const expiryDate = getEventPassExpiryDate(event);
  return Boolean(expiryDate && expiryDate <= referenceDate);
};

const clearExpiredEventPass = (attendee, event, referenceDate = new Date()) => {
  if (!attendee?.checkInToken || !hasEventPassExpired(event, referenceDate)) {
    return false;
  }

  attendee.checkInToken = "";
  return true;
};

const hasEventEnded = (event, referenceDate = new Date()) => {
  if (event?.endedAt) {
    return true;
  }

  const endDate = getEventEndDate(event);
  return Boolean(endDate && endDate <= referenceDate);
};

const getEventStatusClass = (event, referenceDate = new Date()) => {
  const startDate = new Date(event?.date);
  const endDate = getEventEndDate(event);
  const deadline = event?.registrationDeadline ? new Date(event.registrationDeadline) : null;

  if (event?.endedAt) return "done";
  if (endDate && endDate <= referenceDate) return "done";
  if (!Number.isNaN(startDate.getTime()) && endDate && startDate <= referenceDate && endDate > referenceDate) {
    return "live";
  }
  if (
    deadline &&
    !Number.isNaN(deadline.getTime()) &&
    deadline > referenceDate &&
    !Number.isNaN(startDate.getTime()) &&
    startDate > referenceDate
  ) {
    return "open";
  }
  return "upcoming";
};

const buildCoordinatorEventCatalogQuery = ({
  userId,
  scope = "mine",
  search = "",
  status = "all",
  referenceDate = new Date(),
}) => {
  const andClauses = [];

  if (scope !== "all") {
    andClauses.push({ createdBy: userId });
  }

  const trimmedSearch = String(search || "").trim();
  if (trimmedSearch) {
    const searchRegex = new RegExp(escapeRegex(trimmedSearch), "i");
    andClauses.push({
      $or: [
        { title: searchRegex },
        { description: searchRegex },
        { venue: searchRegex },
      ],
    });
  }

  if (status === "done") {
    andClauses.push({
      $or: [
        { endedAt: { $ne: null } },
        { endDate: { $lte: referenceDate } },
        { endDate: null, date: { $lte: referenceDate } },
      ],
    });
  } else if (status === "live") {
    andClauses.push(
      { endedAt: null },
      { date: { $lte: referenceDate } },
      { endDate: { $gt: referenceDate } }
    );
  } else if (status === "open") {
    andClauses.push(
      { endedAt: null },
      { date: { $gt: referenceDate } },
      { registrationDeadline: { $gt: referenceDate } }
    );
  } else if (status === "upcoming") {
    andClauses.push(
      { endedAt: null },
      { date: { $gt: referenceDate } },
      {
        $or: [
          { registrationDeadline: { $lte: referenceDate } },
          { registrationDeadline: null },
          { registrationDeadline: { $exists: false } },
        ],
      }
    );
  }

  if (andClauses.length === 0) {
    return {};
  }

  if (andClauses.length === 1) {
    return andClauses[0];
  }

  return { $and: andClauses };
};

const finalizeCompletedEvent = (event, referenceDate = new Date()) => {
  if (!event || event.endedAt) {
    return false;
  }

  const endDate = getEventEndDate(event);
  if (!endDate || endDate > referenceDate) {
    return false;
  }

  let changed = false;
  event.endedAt = endDate;
  changed = true;

  (event.attendees || []).forEach((attendee) => {
    if (attendee.status === "present" && !attendee.certificateIssuedAt) {
      attendee.certificateIssuedAt = endDate;
      attendee.certificateNumber = generateCertificateNumber(
        event._id,
        attendee.user?._id || attendee.user
      );
      changed = true;
    }
  });

  if (normalizeRankingAssignments(event)) {
    changed = true;
  }

  return changed;
};

const ensureCertificatesForEvent = async (event) => {
  if (!event?._id) {
    return false;
  }

  if (!hasEventEnded(event)) {
    return false;
  }

  const presentAttendees = (event.attendees || []).filter((attendee) => attendee.status === "present");
  if (presentAttendees.length === 0) {
    return false;
  }

  const participantIds = presentAttendees.map((attendee) => attendee.user?._id || attendee.user);
  const normalizedParticipantIds = participantIds.map((participantId) => participantId?.toString()).filter(Boolean);

  const [participants, existingCertificates, coordinator] = await Promise.all([
    User.find({ _id: { $in: normalizedParticipantIds } })
      .select("fullName username email department year")
      .lean(),
    Certificate.find({
      eventId: event._id,
      participantId: { $in: normalizedParticipantIds },
      $or: [
        { certificateType: "participation" },
        { certificateType: { $exists: false } },
        { certificateType: null },
      ],
    })
      .select("participantId certificateNumber issuedAt")
      .lean(),
    User.findById(event.createdBy).select("fullName username").lean(),
  ]);

  const participantMap = new Map(
    participants.map((participant) => [String(participant._id), participant])
  );
  const certificateMap = new Map(
    existingCertificates.map((certificate) => [String(certificate.participantId), certificate])
  );

  const operations = [];
  let eventChanged = false;

  presentAttendees.forEach((attendee) => {
    const participantId = String(attendee.user?._id || attendee.user || "");
    if (!participantId) {
      return;
    }

    const existingCertificate = certificateMap.get(participantId);
    if (existingCertificate) {
      const existingIssuedAt = existingCertificate.issuedAt || attendee.certificateIssuedAt || event.endedAt || getEventEndDate(event) || new Date();
      if (!attendee.certificateIssuedAt || String(attendee.certificateNumber || "") !== String(existingCertificate.certificateNumber || "")) {
        attendee.certificateIssuedAt = existingIssuedAt;
        attendee.certificateNumber = existingCertificate.certificateNumber || "";
        eventChanged = true;
      }
      return;
    }

    const participant = participantMap.get(participantId);
    const issuedAt = attendee.certificateIssuedAt || event.endedAt || getEventEndDate(event) || new Date();
    const certificateNumber = attendee.certificateNumber || generateCertificateNumber(event._id, participantId);
    const recipientName =
      participant?.fullName || participant?.username || "Participant";
    const coordinatorName =
      coordinator?.fullName || coordinator?.username || "Coordinator";

    operations.push({
      updateOne: {
        filter: {
          participantId,
          eventId: event._id,
          certificateType: "participation",
        },
        update: {
          $setOnInsert: {
            attendeeId: attendee._id,
            resultId: null,
            certificateNumber,
            recipientName,
            recipientEmail: participant?.email || "",
            department: participant?.department || "",
            admissionYear:
              participant?.year === null || participant?.year === undefined
                ? ""
                : String(participant.year),
            eventTitle: event.title,
            eventDate: event.date,
            eventEndDate: getEventEndDate(event) || event.date,
            venue: event.venue || "",
            coordinatorId: event.createdBy,
            coordinatorName,
            certificateType: "participation",
            rank: null,
            achievementTitle: "",
            issuedAt,
          },
        },
        upsert: true,
      },
    });

    if (
      !attendee.certificateIssuedAt ||
      String(attendee.certificateNumber || "") !== String(certificateNumber)
    ) {
      attendee.certificateIssuedAt = issuedAt;
      attendee.certificateNumber = certificateNumber;
      eventChanged = true;
    }
  });

  if (operations.length > 0) {
    await Certificate.bulkWrite(operations, { ordered: false });
  }

  return eventChanged || operations.length > 0;
};

const ensureRankingCertificatesForEvent = async (event) => {
  if (!event?._id || !isRankingEvent(event) || !event?.rankingConfig?.resultsPublished) {
    return false;
  }

  const rankingResults = await EventResult.find({
    eventId: event._id,
    publishedAt: { $ne: null },
  })
    .sort({ rank: 1 })
    .lean();

  if (rankingResults.length === 0) {
    return false;
  }

  const participantIds = rankingResults.map((entry) => entry.participantId).filter(Boolean);
  const [participants, existingCertificates, coordinator] = await Promise.all([
    User.find({ _id: { $in: participantIds } })
      .select("fullName username email department year")
      .lean(),
    Certificate.find({
      eventId: event._id,
      participantId: { $in: participantIds },
      certificateType: "achievement",
    })
      .select("participantId")
      .lean(),
    User.findById(event.createdBy).select("fullName username").lean(),
  ]);

  const participantMap = new Map(
    participants.map((participant) => [String(participant._id), participant])
  );
  const certificateMap = new Map(
    existingCertificates.map((certificate) => [String(certificate.participantId), certificate])
  );
  const operations = [];

  rankingResults.forEach((result) => {
    const participantId = String(result.participantId || "");
    if (!participantId || certificateMap.has(participantId)) {
      return;
    }

    const participant = participantMap.get(participantId);
    operations.push({
      updateOne: {
        filter: {
          participantId,
          eventId: event._id,
          certificateType: "achievement",
        },
        update: {
          $setOnInsert: {
            attendeeId: result.attendeeId,
            resultId: result._id,
            certificateNumber: generateCertificateNumber(event._id, participantId),
            recipientName: participant?.fullName || participant?.username || "Participant",
            recipientEmail: participant?.email || "",
            department: participant?.department || "",
            admissionYear:
              participant?.year === null || participant?.year === undefined
                ? ""
                : String(participant.year),
            eventTitle: event.title,
            eventDate: event.date,
            eventEndDate: getEventEndDate(event) || event.date,
            venue: event.venue || "",
            coordinatorId: event.createdBy,
            coordinatorName: coordinator?.fullName || coordinator?.username || "Coordinator",
            certificateType: "achievement",
            rank: result.rank,
            achievementTitle: getAchievementTitleForRank(result.rank),
            issuedAt: result.publishedAt || event.endedAt || getEventEndDate(event) || new Date(),
          },
        },
        upsert: true,
      },
    });
  });

  if (operations.length > 0) {
    await Certificate.bulkWrite(operations, { ordered: false });
  }

  return operations.length > 0;
};

const syncCertificatesFromEvents = async () => {
  const events = await Event.find({
    attendees: {
      $elemMatch: {
        status: "present",
      },
    },
  });

  for (const event of events) {
    if (finalizeCompletedEvent(event)) {
      await event.save();
    }

    if (normalizeRankingAssignments(event)) {
      await event.save();
    }

    if (await ensureCertificatesForEvent(event)) {
      await event.save();
    }

    await ensureRankingCertificatesForEvent(event);
  }
};

const finalizeCompletedEvents = async (events, referenceDate = new Date()) => {
  const changedEvents = [];

  (events || []).forEach((event) => {
    if (finalizeCompletedEvent(event, referenceDate)) {
      changedEvents.push(event);
    }
  });

  if (changedEvents.length > 0) {
    await Promise.all(changedEvents.map((event) => event.save()));
  }

  for (const event of events || []) {
    if (await ensureCertificatesForEvent(event)) {
      await event.save();
    }

    await ensureRankingCertificatesForEvent(event);
  }
};

const getIncompleteProfileFields = (user) => {
  if (!user) {
    return ["fullName", "phone", "department"];
  }

  const missingFields = [];
  const fullName = String(user.fullName || "").trim();
  const phone = String(user.phone || "").trim();
  const department = String(user.department || "").trim();
  const year = user.year === null || user.year === undefined ? "" : String(user.year).trim();

  if (!fullName) missingFields.push("fullName");
  if (!phone) missingFields.push("phone");
  if (!department) missingFields.push("department");
  if (department !== "Staff" && !year) missingFields.push("year");

  return missingFields;
};

const isUserProfileComplete = (user) => getIncompleteProfileFields(user).length === 0;

const canUseStaffDepartment = (role) => ["admin", "coordinator"].includes(role);

const formatRankingResultEntry = (result, participant = null) => ({
  _id: result._id,
  eventId: result.eventId,
  participantId: participant?._id || result.participantId,
  attendeeId: result.attendeeId,
  rank: result.rank,
  note: result.note || "",
  publishedAt: result.publishedAt || null,
  name: participant?.fullName || participant?.username || "Participant",
  email: participant?.email || "",
  department: participant?.department || "",
  year: participant?.year ?? null,
  profileImage: participant?.profileImage || "",
});

const attachPublishedResultsToSerializedEvents = async (serializedEvents) => {
  const rankingEventIds = (serializedEvents || [])
    .filter((event) => isRankingEvent(event) && event?.rankingConfig?.resultsPublished)
    .map((event) => event._id)
    .filter(Boolean);

  if (rankingEventIds.length === 0) {
    return serializedEvents.map((event) => ({ ...event, leaderboard: [] }));
  }

  const results = await EventResult.find({
    eventId: { $in: rankingEventIds },
    publishedAt: { $ne: null },
  })
    .populate("participantId", "username fullName email department year profileImage")
    .sort({ rank: 1, createdAt: 1 })
    .lean();

  const leaderboardMap = new Map();
  results.forEach((result) => {
    const eventId = String(result.eventId);
    if (!leaderboardMap.has(eventId)) {
      leaderboardMap.set(eventId, []);
    }
    leaderboardMap.get(eventId).push(formatRankingResultEntry(result, result.participantId));
  });

  return serializedEvents.map((event) => ({
    ...event,
    leaderboard: leaderboardMap.get(String(event._id)) || [],
  }));
};

const serializePublicEvent = (event) => {
  const eventData = typeof event?.toObject === "function" ? event.toObject() : event;
  const venueRecord =
    eventData.venueId && typeof eventData.venueId === "object" && !Array.isArray(eventData.venueId)
      ? eventData.venueId
      : null;

  return {
    ...eventData,
    eventMode: normalizeEventMode(eventData.eventMode),
    rankingConfig: {
      metricLabel: String(eventData?.rankingConfig?.metricLabel || ""),
      metricUnit: String(eventData?.rankingConfig?.metricUnit || ""),
      rankingOrder: getRankingOrder(eventData),
      resultsPublished: Boolean(eventData?.rankingConfig?.resultsPublished),
    },
    venueDetails: venueRecord
      ? {
          _id: venueRecord._id,
          name: venueRecord.name,
          location: venueRecord.location || "",
          description: venueRecord.description || "",
          capacity: venueRecord.capacity ?? null,
        }
      : null,
    attendees: (eventData.attendees || []).map((attendee) => ({
      _id: attendee._id,
      user: attendee.user?._id || attendee.user,
      status: attendee.status,
      certificateIssuedAt: attendee.certificateIssuedAt,
      certificateNumber: attendee.certificateNumber,
      checkedInAt: attendee.checkedInAt,
      checkInMethod: attendee.checkInMethod,
    })),
    leaderboard: [],
  };
};

// =========================
// MIDDLEWARE
// =========================
app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(uploadsDir));

// =========================
// MONGODB CONNECTION
// =========================
mongoose.connect(MONGODB_URI)
  .then(async () => {
    console.log("MongoDB connected");
    await migrateLegacyCertificates();
    await Certificate.syncIndexes();
    await EventResult.syncIndexes();
    await syncVenueCatalogFromEvents();
    await syncCertificatesFromEvents();
  })
  .catch(err => console.log("Mongo error:", err));

// =========================
// MULTER CONFIGURATION
// =========================
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only image files allowed"));
  }
});

// =========================
// AUTH ROUTES
// =========================
app.post("/register", async (req, res) => {
  try {
    if (req.body?.department === "Staff" && !canUseStaffDepartment(req.body?.role)) {
      return res.status(400).json({ error: "Only admins and coordinators can use the Staff department" });
    }

    const user = await User.create(req.body);
    res.status(201).json(user);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: "User not found" });
    if (user.password !== password) return res.status(400).json({ error: "Invalid password" });

    // Enforce active bans for participants (temporary and permanent)
    if (user.role === "participant" && user.isBanned) {
      const now = new Date();
      if (!user.bannedUntil) {
        return res.status(403).json({
          error: "You are permanently banned by admin",
          permanent: true,
          banReason: user.banReason || ""
        });
      }

      if (new Date(user.bannedUntil) > now) {
        return res.status(403).json({
          error: "You are temporarily banned by admin",
          bannedUntil: user.bannedUntil,
          banReason: user.banReason || ""
        });
      }

      // Auto-clear expired temporary ban
      user.isBanned = false;
      user.bannedUntil = null;
      user.banReason = "";
      await user.save();
    }

    const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: "24h" });
    res.json({
      token,
      role: user.role,
      username: user.username,
      email: user.email
    });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

// =========================
// USER PROFILE ROUTES
// =========================
app.get("/users/profile", verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user);
  } catch (err) {
    console.error("Profile fetch error:", err);
    res.status(500).json({ error: "Failed to fetch profile" });
  }
});

// IMPORTANT: Add upload.single("profileImage") middleware
app.put("/users/profile", verifyToken, upload.single("profileImage"), async (req, res) => {
  try {
    console.log("Update request body:", req.body);
    console.log("Update request file:", req.file);
    
    const { fullName, phone, department, year, removeImage } = req.body;
    
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: "User not found" });

    if (department === "Staff" && !canUseStaffDepartment(user.role)) {
      return res.status(400).json({ error: "Only admins and coordinators can use the Staff department" });
    }

    // Update fields if provided
    if (fullName !== undefined) user.fullName = fullName;
    if (phone !== undefined) user.phone = phone;
    if (department !== undefined) user.department = department;
    if (year !== undefined) user.year = year;
    
    // Handle profile image if uploaded
    if (req.file) {
      user.profileImage = req.file.filename;
    } else if (removeImage === "true") {
      user.profileImage = "default.png";
    }

    await user.save();

    // Return updated user without password
    const updatedUser = await User.findById(req.user.id).select("-password");
    
    res.json({ 
      message: "Profile updated successfully", 
      user: updatedUser 
    });
    
  } catch (err) {
    console.error("Profile update error:", err);
    res.status(500).json({ error: "Update failed" });
  }
});
// =========================
// USER MANAGEMENT
// =========================
app.get("/users", verifyToken, requireAdmin, async (req, res) => {
  try {
    const users = await User.find({}, "-password");
    res.json(users);
  } catch {
    res.status(500).json({ error: "Could not fetch users" });
  }
});

app.put("/users/:id", verifyToken, requireAdmin, async (req, res) => {
  try {
    const updates = { role: req.body.role };
    const existingUser = await User.findById(req.params.id);
    if (!existingUser) return res.status(404).json({ error: "User not found" });

    if (!canUseStaffDepartment(req.body.role) && existingUser.department === "Staff") {
      updates.department = "";
      updates.year = "";
    }

    const updatedUser = await User.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!updatedUser) return res.status(404).json({ error: "User not found" });
    res.json(updatedUser);
  } catch {
    res.status(500).json({ error: "Update failed" });
  }
});

app.delete("/users/:id", verifyToken, requireAdmin, async (req, res) => {
  try {
    const deletedUser = await User.findByIdAndDelete(req.params.id);
    if (!deletedUser) return res.status(404).json({ error: "User not found" });
    res.json({ message: "User deleted successfully" });
  } catch {
    res.status(500).json({ error: "Delete failed" });
  }
});

// =========================
// DIRECT MESSAGES
// =========================
app.post("/conversations", verifyToken, async (req, res) => {
  try {
    const { participantId, eventId = null } = req.body;
    if (!participantId) {
      return res.status(400).json({ error: "participantId is required" });
    }

    if (participantId === req.user.id) {
      return res.status(400).json({ error: "Cannot create conversation with yourself" });
    }

    const participantUser = await User.findById(participantId).select("_id");
    if (!participantUser) {
      return res.status(404).json({ error: "Participant not found" });
    }

    let conversation = await Conversation.findOne({
      participants: { $all: [req.user.id, participantId], $size: 2 },
    }).populate("participants", "username email role phone profileImage");

    if (!conversation) {
      conversation = await Conversation.create({
        participants: [req.user.id, participantId],
        eventId,
      });

      conversation = await Conversation.findById(conversation._id).populate(
        "participants",
        "username email role phone profileImage"
      );
    }

    res.status(201).json(conversation);
  } catch (err) {
    console.error("Create conversation error:", err);
    res.status(500).json({ error: "Failed to create conversation" });
  }
});

app.get("/conversations", verifyToken, async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const conversations = await Conversation.find({
      participants: currentUserId,
    })
      .populate("participants", "username email role phone profileImage")
      .sort({ lastMessageAt: -1 });

    const conversationIds = conversations.map((conversation) => conversation._id);
    const lastMessages = await Message.aggregate([
      { $match: { conversationId: { $in: conversationIds } } },
      { $sort: { createdAt: -1 } },
      { $group: { _id: "$conversationId", message: { $first: "$$ROOT" } } },
    ]);

    const lastMessageByConversation = {};
    lastMessages.forEach(({ _id, message }) => {
      lastMessageByConversation[_id.toString()] = message;
    });

    const sentMessages = await Message.aggregate([
      {
        $match: {
          conversationId: { $in: conversationIds },
          sender: new mongoose.Types.ObjectId(currentUserId),
        },
      },
      { $group: { _id: "$conversationId", count: { $sum: 1 } } },
    ]);

    const sentMessageByConversation = {};
    sentMessages.forEach(({ _id, count }) => {
      sentMessageByConversation[_id.toString()] = count > 0;
    });

    const serialized = conversations.map((conversation) =>
      serializeConversation(
        conversation,
        currentUserId,
        lastMessageByConversation,
        sentMessageByConversation
      )
    );

    res.json(serialized);
  } catch (err) {
    console.error("List conversations error:", err);
    res.status(500).json({ error: "Failed to fetch conversations" });
  }
});

app.get("/chat/contacts", verifyToken, async (req, res) => {
  try {
    const contacts = await User.find(
      { _id: { $ne: req.user.id } },
      "username email role phone profileImage"
    ).sort({ username: 1 });

    res.json(contacts);
  } catch (err) {
    console.error("List contacts error:", err);
    res.status(500).json({ error: "Failed to fetch contacts" });
  }
});

app.get("/conversations/:id/messages", verifyToken, async (req, res) => {
  try {
    const { before } = req.query;
    const limit = Math.min(parseInt(req.query.limit || "40", 10), 100);
    const conversation = await Conversation.findById(req.params.id).select("participants");

    if (!conversation) return res.status(404).json({ error: "Conversation not found" });

    const isParticipant = conversation.participants.some(
      (participantId) => participantId.toString() === req.user.id
    );

    if (!isParticipant) {
      return res.status(403).json({ error: "Not allowed to access this conversation" });
    }

    const query = { conversationId: req.params.id };
    if (before) {
      query.createdAt = { $lt: new Date(before) };
    }

    const messages = await Message.find(query)
      .populate("sender", "username email role phone profileImage")
      .sort({ createdAt: -1 })
      .limit(limit);

    res.json(messages.reverse());
  } catch (err) {
    console.error("Get messages error:", err);
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

app.post("/conversations/:id/messages", verifyToken, async (req, res) => {
  try {
    const content = (req.body.content || "").trim();
    if (!content) {
      return res.status(400).json({ error: "Message content is required" });
    }

    if (content.length > 2000) {
      return res.status(400).json({ error: "Message content too long" });
    }

    const conversation = await Conversation.findById(req.params.id).select("participants");
    if (!conversation) return res.status(404).json({ error: "Conversation not found" });

    const isParticipant = conversation.participants.some(
      (participantId) => participantId.toString() === req.user.id
    );

    if (!isParticipant) {
      return res.status(403).json({ error: "Not allowed to send in this conversation" });
    }

    let message = await Message.create({
      conversationId: req.params.id,
      sender: req.user.id,
      content,
      readBy: [req.user.id],
    });

    await Conversation.findByIdAndUpdate(req.params.id, { lastMessageAt: new Date() });
    message = await Message.findById(message._id).populate(
      "sender",
      "username email role phone profileImage"
    );

    for (const participantId of conversation.participants) {
      io.to(`user:${participantId.toString()}`).emit("message:new", {
        conversationId: req.params.id,
        message,
      });
    }

    io.to(`conversation:${req.params.id}`).emit("conversation:updated", {
      conversationId: req.params.id,
      lastMessageAt: new Date(),
    });

    res.status(201).json(message);
  } catch (err) {
    console.error("Send message error:", err);
    res.status(500).json({ error: "Failed to send message" });
  }
});

app.patch("/conversations/:conversationId/messages/:messageId/delete", verifyToken, async (req, res) => {
  try {
    const { conversationId, messageId } = req.params;
    const conversation = await Conversation.findById(conversationId).select("participants");

    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    const isParticipant = conversation.participants.some(
      (participantId) => participantId.toString() === req.user.id
    );

    if (!isParticipant) {
      return res.status(403).json({ error: "Not allowed to access this conversation" });
    }

    const message = await Message.findOne({
      _id: messageId,
      conversationId,
    }).populate("sender", "username email role phone profileImage");

    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }

    if (message.sender._id.toString() !== req.user.id) {
      return res.status(403).json({ error: "Only the sender can delete this message" });
    }

    if (!message.isDeleted) {
      message.content = "the message has been deleted by the user";
      message.isDeleted = true;
      message.deletedAt = new Date();
      message.deletedBy = req.user.id;
      await message.save();
    }

    const serializedMessage = await Message.findById(message._id).populate(
      "sender",
      "username email role phone profileImage"
    );

    for (const participantId of conversation.participants) {
      io.to(`user:${participantId.toString()}`).emit("message:deleted", {
        conversationId,
        message: serializedMessage,
      });
    }

    io.to(`conversation:${conversationId}`).emit("message:deleted", {
      conversationId,
      message: serializedMessage,
    });

    res.json(serializedMessage);
  } catch (err) {
    console.error("Delete message error:", err);
    res.status(500).json({ error: "Failed to delete message" });
  }
});

app.patch("/conversations/:id/read", verifyToken, async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.id).select("participants");
    if (!conversation) return res.status(404).json({ error: "Conversation not found" });

    const isParticipant = conversation.participants.some(
      (participantId) => participantId.toString() === req.user.id
    );

    if (!isParticipant) {
      return res.status(403).json({ error: "Not allowed to access this conversation" });
    }

    await Message.updateMany(
      {
        conversationId: req.params.id,
        sender: { $ne: req.user.id },
        readBy: { $ne: req.user.id },
      },
      { $addToSet: { readBy: req.user.id } }
    );

    res.json({ message: "Conversation marked as read" });
  } catch (err) {
    console.error("Mark read error:", err);
    res.status(500).json({ error: "Failed to update read state" });
  }
});

app.get("/events", async (req, res) => {
  try {
    const events = await Event.find()
      .populate("createdBy", "username fullName email role")
      .populate("venueId", "name location description capacity")
      .populate("attendees.user", "username fullName department year")
      .sort({ createdAt: -1 });

    await finalizeCompletedEvents(events);

    res.json(await attachPublishedResultsToSerializedEvents(events.map((event) => serializePublicEvent(event))));
  } catch {
    res.status(500).json({ error: "Could not fetch events" });
  }
});

app.get("/venues", verifyToken, async (req, res) => {
  try {
    if (!["admin", "coordinator"].includes(req.user.role)) {
      return res.status(403).json({ error: "You are not allowed to access venues" });
    }

    await syncVenueCatalogFromEvents();

    const venues = await Venue.find({ isActive: true })
      .sort({ name: 1 })
      .lean();

    res.json(
      venues.map((venue) => ({
        _id: venue._id,
        name: venue.name,
        location: venue.location,
        description: venue.description,
        capacity: venue.capacity,
      }))
    );
  } catch (err) {
    console.error("Venue fetch error:", err);
    res.status(500).json({ error: "Failed to load venues" });
  }
});

app.get("/venues/availability", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "coordinator") {
      return res.status(403).json({ error: "Only coordinators can check venue availability" });
    }

    const { venueId, startDate, endDate } = req.query;

    if (!venueId || !mongoose.Types.ObjectId.isValid(venueId)) {
      return res.status(400).json({ error: "Valid venueId is required" });
    }

    const parsedStartDate = new Date(startDate);
    const parsedEndDate = new Date(endDate);

    if (Number.isNaN(parsedStartDate.getTime()) || Number.isNaN(parsedEndDate.getTime())) {
      return res.status(400).json({ error: "Valid startDate and endDate are required" });
    }

    if (parsedEndDate <= parsedStartDate) {
      return res.status(400).json({ error: "End date must be after start date" });
    }

    const venue = await Venue.findOne({ _id: venueId, isActive: true }).lean();
    if (!venue) {
      return res.status(404).json({ error: "Venue not found" });
    }

    const conflictingEvents = await Event.find({
      $and: [
        {
          $or: [
            { venueId: venue._id },
            { venue: { $regex: `^${escapeRegex(venue.name)}$`, $options: "i" } },
          ],
        },
        { date: { $lte: parsedEndDate } },
        {
          $or: [
            { endDate: { $gte: parsedStartDate } },
            { endDate: null, date: { $gte: parsedStartDate } },
            { endDate: { $exists: false }, date: { $gte: parsedStartDate } },
          ],
        },
      ],
    })
      .select("title date endDate endedAt")
      .sort({ date: 1 })
      .lean();

    res.json({
      available: conflictingEvents.length === 0,
      venue: {
        _id: venue._id,
        name: venue.name,
        capacity: venue.capacity,
      },
      conflicts: conflictingEvents.map((event) => ({
        _id: event._id,
        title: event.title,
        date: event.date,
        endDate: event.endDate || event.date,
        endedAt: event.endedAt,
      })),
    });
  } catch (err) {
    console.error("Venue availability error:", err);
    res.status(500).json({ error: "Failed to check venue availability" });
  }
});

app.post("/venues", verifyToken, requireAdmin, async (req, res) => {
  try {
    const venueName = typeof req.body.name === "string" ? req.body.name.trim() : "";
    const normalizedVenueName = normalizeVenueName(venueName);

    if (!normalizedVenueName) {
      return res.status(400).json({ error: "Venue name is required" });
    }

    const venue = await Venue.create({
      name: venueName.replace(/\s+/g, " "),
      location: typeof req.body.location === "string" ? req.body.location.trim() : "",
      description:
        typeof req.body.description === "string" ? req.body.description.trim() : "",
      capacity:
        req.body.capacity === "" || req.body.capacity === undefined
          ? null
          : Number(req.body.capacity),
    });

    res.status(201).json(venue);
  } catch (err) {
    console.error("Venue create error:", err);

    if (err?.code === 11000) {
      return res.status(409).json({ error: "A venue with this name already exists" });
    }

    res.status(400).json({ error: err.message });
  }
});

app.put("/venues/:id", verifyToken, requireAdmin, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: "Invalid venue id" });
    }

    const venue = await Venue.findById(req.params.id);
    if (!venue) {
      return res.status(404).json({ error: "Venue not found" });
    }

    const venueName = typeof req.body.name === "string" ? req.body.name.trim() : "";
    const normalizedVenueName = normalizeVenueName(venueName);

    if (!normalizedVenueName) {
      return res.status(400).json({ error: "Venue name is required" });
    }

    venue.name = venueName.replace(/\s+/g, " ");
    venue.location = typeof req.body.location === "string" ? req.body.location.trim() : "";
    venue.description =
      typeof req.body.description === "string" ? req.body.description.trim() : "";
    venue.capacity =
      req.body.capacity === "" || req.body.capacity === undefined
        ? null
        : Number(req.body.capacity);

    await venue.save();

    await Event.updateMany(
      { venueId: venue._id },
      {
        $set: {
          venue: venue.name,
        },
      }
    );

    res.json(venue);
  } catch (err) {
    console.error("Venue update error:", err);

    if (err?.code === 11000) {
      return res.status(409).json({ error: "A venue with this name already exists" });
    }

    res.status(400).json({ error: err.message });
  }
});

app.get("/venues/:id/history", verifyToken, requireAdmin, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: "Invalid venue id" });
    }

    const venue = await Venue.findById(req.params.id).lean();
    if (!venue) {
      return res.status(404).json({ error: "Venue not found" });
    }

    const events = await Event.find({
      $or: [
        { venueId: venue._id },
        { venue: { $regex: `^${escapeRegex(venue.name)}$`, $options: "i" } },
      ],
    })
      .populate("createdBy", "username fullName email")
      .sort({ date: -1, createdAt: -1 })
      .lean();

    res.json({
      venue: {
        _id: venue._id,
        name: venue.name,
      },
      events: events.map((event) => ({
        _id: event._id,
        title: event.title,
        description: event.description,
        date: event.date,
        endDate: event.endDate || event.date,
        endedAt: event.endedAt,
        capacity: event.capacity,
        attendeeCount: Array.isArray(event.attendees) ? event.attendees.length : 0,
        coordinatorName:
          event.createdBy?.fullName || event.createdBy?.username || "Coordinator",
      })),
    });
  } catch (err) {
    console.error("Venue history error:", err);
    res.status(500).json({ error: "Failed to load venue history" });
  }
});

app.get("/coordinator/events", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "coordinator") {
      return res.status(403).json({ error: "Only coordinators can access this" });
    }

    const events = await Event.find({ createdBy: req.user.id })
      .populate("createdBy", "username email role")
      .populate(
        "attendees.user",
        "username email role fullName department year profileImage createdAt updatedAt"
      )
      .sort({ createdAt: -1 });

    await finalizeCompletedEvents(events);

    res.json(await attachPublishedResultsToSerializedEvents(events.map((event) => serializePublicEvent(event))));
  } catch (err) {
    console.error("Coordinator events fetch error:", err);
    res.status(500).json({ error: "Could not fetch coordinator events" });
  }
});

app.get("/coordinator/events/catalog", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "coordinator") {
      return res.status(403).json({ error: "Only coordinators can access this" });
    }

    const scope = String(req.query.scope || "mine").trim().toLowerCase() === "all" ? "all" : "mine";
    const search = String(req.query.search || "");
    const status = String(req.query.status || "all").trim().toLowerCase();
    const sort = String(req.query.sort || "eventLate").trim();
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(24, Math.max(1, Number.parseInt(req.query.limit, 10) || 9));
    const now = new Date();

    const allowedStatuses = new Set(["all", "live", "open", "upcoming", "done"]);
    const normalizedStatus = allowedStatuses.has(status) ? status : "all";

    const sortOptions = {
      eventLate: { date: -1, createdAt: -1 },
      eventSoon: { date: 1, createdAt: -1 },
      newest: { createdAt: -1, date: -1 },
      oldest: { createdAt: 1, date: 1 },
    };
    const sortQuery = sortOptions[sort] || sortOptions.eventLate;

    const query = buildCoordinatorEventCatalogQuery({
      userId: req.user.id,
      scope,
      search,
      status: normalizedStatus,
      referenceDate: now,
    });

    const statsBaseQuery = buildCoordinatorEventCatalogQuery({
      userId: req.user.id,
      scope,
      search: "",
      status: "all",
      referenceDate: now,
    });

    const dashboardEventSelect =
      "title description date endDate endedAt registrationDeadline venue venueId poster capacity attendees createdBy eventMode rankingConfig createdAt";

    const [events, total, totalScopeEvents, ongoing, registrationOpen, upcoming, past] = await Promise.all([
      Event.find(query)
        .select(dashboardEventSelect)
        .populate("createdBy", "username fullName email role")
        .sort(sortQuery)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Event.countDocuments(query),
      Event.countDocuments(statsBaseQuery),
      Event.countDocuments(
        buildCoordinatorEventCatalogQuery({
          userId: req.user.id,
          scope,
          search: "",
          status: "live",
          referenceDate: now,
        })
      ),
      Event.countDocuments(
        buildCoordinatorEventCatalogQuery({
          userId: req.user.id,
          scope,
          search: "",
          status: "open",
          referenceDate: now,
        })
      ),
      Event.countDocuments(
        buildCoordinatorEventCatalogQuery({
          userId: req.user.id,
          scope,
          search: "",
          status: "upcoming",
          referenceDate: now,
        })
      ),
      Event.countDocuments(
        buildCoordinatorEventCatalogQuery({
          userId: req.user.id,
          scope,
          search: "",
          status: "done",
          referenceDate: now,
        })
      ),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / limit));

    res.json({
      items: await attachPublishedResultsToSerializedEvents(events.map((event) => ({
        ...serializePublicEvent(event),
        catalogStatus: getEventStatusClass(event, now),
      }))),
      scope,
      filters: {
        search,
        status: normalizedStatus,
        sort,
      },
      pagination: {
        page: Math.min(page, totalPages),
        limit,
        total,
        totalPages,
      },
      stats: {
        total: totalScopeEvents,
        ongoing,
        upcoming,
        registrationOpen,
        past,
      },
    });
  } catch (err) {
    console.error("Coordinator event catalog fetch error:", err);
    res.status(500).json({ error: "Could not fetch event catalog" });
  }
});

app.get("/coordinator/events/:id/attendees", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "coordinator") {
      return res.status(403).json({ error: "Only coordinators can access this" });
    }

    const event = await Event.findOne({
      _id: req.params.id,
      createdBy: req.user.id,
    }).select("title date endDate endedAt attendees eventMode rankingConfig");

    if (!event) {
      return res.status(404).json({ error: "Event not found or not owned by coordinator" });
    }

    if (finalizeCompletedEvent(event)) {
      await event.save();
    }

    if (normalizeRankingAssignments(event)) {
      await event.save();
    }

    const changed = ensureEventAttendeeTokens(event);
    if (changed) {
      await event.save();
    }

    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(200, Math.max(10, Number.parseInt(req.query.limit, 10) || 50));
    const search = String(req.query.search || "").trim();
    const statusFilter = String(req.query.status || "all").trim().toLowerCase();

    const attendeeIds = (event.attendees || [])
      .map((attendee) => attendee.user)
      .filter(Boolean);

    const userQuery = {
      _id: { $in: attendeeIds },
    };

    if (search) {
      const searchRegex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      userQuery.$or = [
        { username: searchRegex },
        { email: searchRegex },
        { fullName: searchRegex },
        { department: searchRegex },
      ];
    }

    const [users, rankingResults] = await Promise.all([
      User.find(
        userQuery,
        "username email role fullName department year profileImage createdAt updatedAt"
      ).lean(),
      isRankingEvent(event)
        ? EventResult.find({ eventId: event._id })
            .select("participantId attendeeId rank note publishedAt")
            .lean()
        : Promise.resolve([]),
    ]);

    const userMap = new Map(users.map((user) => [user._id.toString(), user]));
    const resultMap = new Map(
      rankingResults.map((entry) => [String(entry.participantId || ""), entry])
    );

    const filteredAttendees = (event.attendees || [])
      .map((attendee) => {
        const participantId = attendee.user?.toString?.() || "";
        const user = userMap.get(participantId) || null;
        return {
          _id: attendee._id,
          status: attendee.status,
          participantId,
          checkedInAt: attendee.checkedInAt,
          checkInMethod: attendee.checkInMethod,
          rank: resultMap.get(participantId)?.rank ?? null,
          resultNote: resultMap.get(participantId)?.note || "",
          resultEnteredAt: resultMap.get(participantId)?.publishedAt || null,
          hasPublishedResult: Boolean(resultMap.get(participantId)?.publishedAt),
          user,
        };
      })
      .filter((attendee) => attendee.user)
      .filter((attendee) => {
        if (statusFilter === "all") return true;
        return attendee.status === statusFilter;
      })
      .sort((a, b) => {
        const left = `${a.user?.fullName || ""} ${a.user?.username || ""}`.trim().toLowerCase();
        const right = `${b.user?.fullName || ""} ${b.user?.username || ""}`.trim().toLowerCase();
        return left.localeCompare(right);
      });

    const total = filteredAttendees.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const normalizedPage = Math.min(page, totalPages);
    const startIndex = (normalizedPage - 1) * limit;
    const attendees = filteredAttendees.slice(startIndex, startIndex + limit);

    const counts = (event.attendees || []).reduce(
      (summary, attendee) => {
        summary.total += 1;
        summary[attendee.status] = (summary[attendee.status] || 0) + 1;
        return summary;
      },
      { total: 0, registered: 0, present: 0, absent: 0 }
    );

    res.json({
      eventId: event._id,
      eventTitle: event.title,
      endedAt: event.endedAt,
      eventMode: normalizeEventMode(event.eventMode),
      rankingConfig: {
        metricLabel: String(event?.rankingConfig?.metricLabel || ""),
        metricUnit: String(event?.rankingConfig?.metricUnit || ""),
        rankingOrder: getRankingOrder(event),
        resultsPublished: Boolean(event?.rankingConfig?.resultsPublished),
      },
      attendees,
      count: total,
      counts,
      pagination: {
        page: normalizedPage,
        limit,
        total,
        totalPages,
      },
      filters: {
        search,
        status: statusFilter,
      },
    });
  } catch (err) {
    console.error("Coordinator attendees fetch error:", err);
    res.status(500).json({ error: "Could not fetch attendees" });
  }
});

app.patch("/coordinator/events/:eventId/end", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "coordinator") {
      return res.status(403).json({ error: "Only coordinators can access this" });
    }

    const event = await Event.findOne({
      _id: req.params.eventId,
      createdBy: req.user.id,
    })
      .populate("createdBy", "username email role")
      .populate(
        "attendees.user",
        "username email role fullName department year profileImage createdAt updatedAt"
      );

    if (!event) {
      return res.status(404).json({ error: "Event not found or not owned by coordinator" });
    }

    if (finalizeCompletedEvent(event)) {
      await event.save();
    }

    if (event.endedAt) {
      return res.status(400).json({ error: "Event has already been ended" });
    }

    const endedAt = new Date();

    event.endedAt = endedAt;
    event.attendees.forEach((attendee) => {
      if (attendee.status === "present" && !attendee.certificateIssuedAt) {
        attendee.certificateIssuedAt = endedAt;
        attendee.certificateNumber = generateCertificateNumber(event._id, attendee.user?._id || attendee.user);
      }
    });

    await event.save();
    await ensureCertificatesForEvent(event);
    await event.save();

    res.json({
      message: "Event ended successfully and certificates were issued to present participants",
      event,
    });
  } catch (err) {
    console.error("Coordinator end event error:", err);
    res.status(500).json({ error: "Could not end event" });
  }
});

app.patch("/coordinator/events/:eventId/attendees/bulk", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "coordinator") {
      return res.status(403).json({ error: "Only coordinators can access this" });
    }

    const { attendeeIds, status } = req.body;
    const allowedStatuses = ["registered", "present", "absent"];

    if (!Array.isArray(attendeeIds) || attendeeIds.length === 0) {
      return res.status(400).json({ error: "attendeeIds must be a non-empty array" });
    }

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ error: "Invalid attendee status" });
    }

    const event = await Event.findOne({
      _id: req.params.eventId,
      createdBy: req.user.id,
    });

    if (!event) {
      return res.status(404).json({ error: "Event not found or not owned by coordinator" });
    }

    if (finalizeCompletedEvent(event)) {
      await event.save();
    }

    if (event.endedAt) {
      return res.status(400).json({ error: "Cannot update attendance after the event has ended" });
    }

    const attendeeIdSet = new Set(attendeeIds.map((id) => String(id)));
    let updatedCount = 0;

    const participantsToClear = [];

    event.attendees.forEach((attendee) => {
      if (!attendeeIdSet.has(String(attendee._id))) {
        return;
      }

      attendee.status = status;
      if (status === "present") {
        markAttendeePresent(attendee, req.user.id, "bulk");
      } else {
        resetAttendeeCheckIn(attendee);
        if (isRankingEvent(event) && attendee.user) {
          participantsToClear.push(String(attendee.user));
        }
      }
      updatedCount += 1;
    });

    normalizeRankingAssignments(event);

    await event.save();

    if (isRankingEvent(event) && participantsToClear.length > 0) {
      await EventResult.deleteMany({
        eventId: event._id,
        participantId: { $in: participantsToClear },
      });
      event.rankingConfig.resultsPublished = false;
      await event.save();
    }

    res.json({
      message: "Bulk attendance update completed",
      updatedCount,
      status,
    });
  } catch (err) {
    console.error("Coordinator bulk attendee update error:", err);
    res.status(500).json({ error: "Could not update attendance in bulk" });
  }
});

app.patch("/coordinator/events/:eventId/ranking", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "coordinator") {
      return res.status(403).json({ error: "Only coordinators can access this" });
    }

    const event = await Event.findOne({
      _id: req.params.eventId,
      createdBy: req.user.id,
    });

    if (!event) {
      return res.status(404).json({ error: "Event not found or not owned by coordinator" });
    }

    if (!isRankingEvent(event)) {
      return res.status(400).json({ error: "This event does not use ranking results" });
    }

    if (event?.rankingConfig?.resultsPublished) {
      return res.status(400).json({ error: "Published results are locked and cannot be edited" });
    }

    const participantId = String(req.body?.participantId || "").trim();
    const attendee = (event.attendees || []).find(
      (entry) => String(entry.user?._id || entry.user || "") === participantId
    );

    if (!participantId || !attendee) {
      return res.status(404).json({ error: "Participant is not registered for this event" });
    }

    if (attendee.status !== "present") {
      return res.status(400).json({ error: "Only present participants can receive ranks" });
    }

    const rank = getNormalizedRankValue(req.body?.rank);
    if (req.body?.rank !== null && req.body?.rank !== undefined && req.body?.rank !== "" && rank === null) {
      return res.status(400).json({ error: "Rank must be a positive whole number" });
    }

    if (rank !== null && rank > (event.attendees || []).length) {
      return res.status(400).json({
        error: `Rank must be between 1 and ${(event.attendees || []).length}`,
      });
    }

    if (rank === null) {
      await EventResult.deleteOne({ eventId: event._id, participantId });
      event.rankingConfig.resultsPublished = false;
      await event.save();

      return res.json({
        message: "Rank removed successfully",
        result: null,
        rankingConfig: {
          metricLabel: String(event?.rankingConfig?.metricLabel || ""),
          metricUnit: String(event?.rankingConfig?.metricUnit || ""),
          rankingOrder: getRankingOrder(event),
          resultsPublished: Boolean(event?.rankingConfig?.resultsPublished),
        },
      });
    }

    const [existingResult, conflictingResult] = await Promise.all([
      EventResult.findOne({ eventId: event._id, participantId }).lean(),
      EventResult.findOne({
        eventId: event._id,
        rank,
        participantId: { $ne: participantId },
      }).lean(),
    ]);

    if (conflictingResult) {
      await EventResult.deleteOne({ _id: conflictingResult._id });
    }

    const resultQuery = existingResult?._id
      ? { _id: existingResult._id }
      : { eventId: event._id, participantId };

    const result = await EventResult.findOneAndUpdate(
      resultQuery,
      {
        $set: {
          attendeeId: attendee._id,
          rank,
          note: String(req.body?.note || "").trim(),
          publishedAt: null,
          publishedBy: null,
          eventId: event._id,
          participantId,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();

    event.rankingConfig.resultsPublished = false;
    await event.save();

    res.json({
      message: conflictingResult
        ? `Rank ${rank} reassigned successfully. The previous participant is now unranked.`
        : "Rank saved successfully",
      result,
      rankingConfig: {
        metricLabel: String(event?.rankingConfig?.metricLabel || ""),
        metricUnit: String(event?.rankingConfig?.metricUnit || ""),
        rankingOrder: getRankingOrder(event),
        resultsPublished: Boolean(event?.rankingConfig?.resultsPublished),
      },
    });
  } catch (err) {
    console.error("Coordinator ranking update error:", err);
    res.status(500).json({ error: "Could not update ranking settings" });
  }
});

app.post("/coordinator/events/:eventId/ranking/publish", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "coordinator") {
      return res.status(403).json({ error: "Only coordinators can access this" });
    }

    const event = await Event.findOne({
      _id: req.params.eventId,
      createdBy: req.user.id,
    });

    if (!event) {
      return res.status(404).json({ error: "Event not found or not owned by coordinator" });
    }

    if (!isRankingEvent(event)) {
      return res.status(400).json({ error: "This event does not use ranking results" });
    }

    if (!hasEventEnded(event)) {
      return res.status(400).json({ error: "Ranking results can only be published after the event ends" });
    }

    const presentParticipantIds = new Set(
      (event.attendees || [])
        .filter((attendee) => attendee.status === "present")
        .map((attendee) => String(attendee.user?._id || attendee.user || ""))
        .filter(Boolean)
    );

    const results = await EventResult.find({ eventId: event._id }).lean();
    if (results.length === 0) {
      return res.status(400).json({ error: "Add at least one ranked participant before publishing" });
    }

    const invalidResult = results.find((entry) => !presentParticipantIds.has(String(entry.participantId || "")));
    if (invalidResult) {
      return res.status(400).json({ error: "Only present participants can have published ranks" });
    }

    const now = new Date();
    await EventResult.updateMany(
      { eventId: event._id },
      { $set: { publishedAt: now, publishedBy: req.user.id } }
    );

    event.rankingConfig.resultsPublished = true;
    await event.save();
    await ensureRankingCertificatesForEvent(event);

    res.json({
      message: "Ranking results published successfully",
      publishedAt: now,
    });
  } catch (err) {
    console.error("Coordinator ranking publish error:", err);
    res.status(500).json({ error: "Could not publish ranking results" });
  }
});

app.post("/coordinator/events/:eventId/message-all", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "coordinator") {
      return res.status(403).json({ error: "Only coordinators can access this" });
    }

    const content = String(req.body?.content || "").trim();
    if (!content) {
      return res.status(400).json({ error: "Message content is required" });
    }

    if (content.length > 2000) {
      return res.status(400).json({ error: "Message content too long" });
    }

    const event = await Event.findOne({
      _id: req.params.eventId,
      createdBy: req.user.id,
    }).select("title attendees");

    if (!event) {
      return res.status(404).json({ error: "Event not found or not owned by coordinator" });
    }

    if (finalizeCompletedEvent(event)) {
      await event.save();
    }

    const participantIds = Array.from(
      new Set(
        (event.attendees || [])
          .map((attendee) => attendee.user?.toString?.())
          .filter(Boolean)
      )
    );

    if (participantIds.length === 0) {
      return res.status(400).json({ error: "No registered participants found for this event" });
    }

    const sender = await User.findById(req.user.id).select(
      "username email role phone profileImage"
    );

    if (!sender) {
      return res.status(404).json({ error: "Coordinator not found" });
    }

    let deliveredCount = 0;

    for (const participantId of participantIds) {
      let conversation = await Conversation.findOne({
        participants: { $all: [req.user.id, participantId], $size: 2 },
      });

      if (!conversation) {
        conversation = await Conversation.create({
          participants: [req.user.id, participantId],
          eventId: event._id,
        });
      } else if (!conversation.eventId) {
        conversation.eventId = event._id;
        await conversation.save();
      }

      let message = await Message.create({
        conversationId: conversation._id,
        sender: req.user.id,
        content,
        readBy: [req.user.id],
      });

      await Conversation.findByIdAndUpdate(conversation._id, { lastMessageAt: new Date() });

      message = await Message.findById(message._id).populate(
        "sender",
        "username email role phone profileImage"
      );

      for (const targetParticipantId of conversation.participants) {
        io.to(`user:${targetParticipantId.toString()}`).emit("message:new", {
          conversationId: conversation._id,
          message,
        });
      }

      io.to(`conversation:${conversation._id}`).emit("conversation:updated", {
        conversationId: conversation._id,
        lastMessageAt: new Date(),
      });

      deliveredCount += 1;
    }

    res.json({
      message: `Message sent to ${deliveredCount} participant${
        deliveredCount === 1 ? "" : "s"
      } for ${event.title}`,
      deliveredCount,
    });
  } catch (err) {
    console.error("Coordinator message-all error:", err);
    res.status(500).json({ error: "Failed to message all participants" });
  }
});

app.get("/coordinator/events/:eventId/scanner-checkins", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "coordinator") {
      return res.status(403).json({ error: "Only coordinators can access this" });
    }

    const event = await Event.findOne({
      _id: req.params.eventId,
      createdBy: req.user.id,
    }).select("title attendees");

    if (!event) {
      return res.status(404).json({ error: "Event not found or not owned by coordinator" });
    }

    const scannerAttendees = (event.attendees || []).filter(
      (attendee) => attendee.checkInMethod === "scanner" && attendee.checkedInAt
    );

    const participantIds = scannerAttendees
      .map((attendee) => attendee.user?.toString?.())
      .filter(Boolean);

    const users = await User.find(
      { _id: { $in: participantIds } },
      "username email fullName department year profileImage"
    ).lean();

    const userMap = new Map(users.map((user) => [user._id.toString(), user]));

    const checkIns = scannerAttendees
      .map((attendee) => ({
        _id: attendee._id,
        participantId: attendee.user,
        status: attendee.status,
        checkedInAt: attendee.checkedInAt,
        checkInMethod: attendee.checkInMethod,
        user: userMap.get(attendee.user?.toString?.() || "") || null,
      }))
      .sort((a, b) => new Date(b.checkedInAt) - new Date(a.checkedInAt));

    res.json({
      eventId: event._id,
      eventTitle: event.title,
      count: checkIns.length,
      checkIns,
    });
  } catch (err) {
    console.error("Coordinator scanner check-ins fetch error:", err);
    res.status(500).json({ error: "Failed to load scanner check-ins" });
  }
});

app.post("/coordinator/events/:eventId/check-in", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "coordinator") {
      return res.status(403).json({ error: "Only coordinators can access this" });
    }

    const token = String(req.body?.token || "").trim();
    if (!token) {
      return res.status(400).json({ error: "Check-in token is required" });
    }

    const event = await Event.findOne({
      _id: req.params.eventId,
      createdBy: req.user.id,
    });

    if (!event) {
      return res.status(404).json({ error: "Event not found or not owned by coordinator" });
    }

    if (finalizeCompletedEvent(event)) {
      await event.save();
    }

    if (event.endedAt) {
      return res.status(400).json({ error: "Cannot check in attendees after the event has ended" });
    }

    const attendee = (event.attendees || []).find((item) => item.checkInToken === token);
    if (!attendee) {
      return res.status(404).json({ error: "Invalid check-in token for this event" });
    }

    const participant = await User.findById(
      attendee.user,
      "username email role fullName department year profileImage"
    ).lean();

    if (!participant) {
      return res.status(404).json({ error: "Participant not found" });
    }

    if (attendee.status === "present" && attendee.checkedInAt) {
      return res.json({
        message: "Participant already checked in",
        alreadyCheckedIn: true,
        attendee: {
          _id: attendee._id,
          participantId: attendee.user,
          status: attendee.status,
          checkedInAt: attendee.checkedInAt,
          checkInMethod: attendee.checkInMethod,
          user: participant,
        },
      });
    }

    markAttendeePresent(attendee, req.user.id, "scanner");
    await event.save();

    res.json({
      message: "Participant checked in successfully",
      alreadyCheckedIn: false,
      attendee: {
        _id: attendee._id,
        participantId: attendee.user,
        status: attendee.status,
        checkedInAt: attendee.checkedInAt,
        checkInMethod: attendee.checkInMethod,
        user: participant,
      },
    });
  } catch (err) {
    console.error("Coordinator check-in error:", err);
    res.status(500).json({ error: "Could not complete check-in" });
  }
});

app.patch("/coordinator/events/:eventId/attendees/:attendeeId", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "coordinator") {
      return res.status(403).json({ error: "Only coordinators can access this" });
    }

    const { status } = req.body;
    const allowedStatuses = ["registered", "present", "absent"];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ error: "Invalid attendee status" });
    }

    const event = await Event.findOne({
      _id: req.params.eventId,
      createdBy: req.user.id,
      "attendees._id": req.params.attendeeId,
    });

    if (!event) {
      return res.status(404).json({ error: "Event or attendee not found" });
    }

    if (finalizeCompletedEvent(event)) {
      await event.save();
    }

    if (event.endedAt) {
      return res.status(400).json({ error: "Cannot update attendance after the event has ended" });
    }

    const attendee = event.attendees.id(req.params.attendeeId);
    if (!attendee) {
      return res.status(404).json({ error: "Attendee not found" });
    }

    attendee.status = status;
    if (status === "present") {
      markAttendeePresent(attendee, req.user.id, "manual");
    } else {
      resetAttendeeCheckIn(attendee);
      if (isRankingEvent(event) && attendee.user) {
        await EventResult.deleteOne({ eventId: event._id, participantId: attendee.user });
        event.rankingConfig.resultsPublished = false;
      }
    }

    await event.save();

    res.json({
      message: "Attendee status updated successfully",
      attendee: {
        _id: attendee._id,
        participantId: attendee.user,
        status: attendee.status,
        checkedInAt: attendee.checkedInAt,
        checkInMethod: attendee.checkInMethod,
      },
    });
  } catch (err) {
    console.error("Coordinator attendee status update error:", err);
    res.status(500).json({ error: "Could not update attendee status" });
  }
});

app.post("/events/:id/register", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "participant") {
      return res.status(403).json({ error: "Only participants can register for events" });
    }

    const participant = await User.findById(req.user.id).select(
      "fullName phone department year role"
    );
    if (!participant) {
      return res.status(404).json({ error: "User not found" });
    }

    if (!isUserProfileComplete(participant)) {
      return res.status(400).json({
        error:
          'Complete your profile before registering. Add your full name, phone number, department, and year if applicable.',
        incompleteFields: getIncompleteProfileFields(participant),
      });
    }

    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ error: "Event not found" });
    }

    if (finalizeCompletedEvent(event)) {
      await event.save();
    }

    const now = new Date();
    const eventStartDate = new Date(event.date);
    const deadline = event.registrationDeadline ? new Date(event.registrationDeadline) : null;

    if (hasEventEnded(event, now)) {
      return res.status(400).json({ error: "This event has already ended" });
    }

    if (eventStartDate <= now) {
      return res.status(400).json({ error: "Cannot register for past events" });
    }

    if (deadline && deadline <= now) {
      return res.status(400).json({ error: "Registration deadline has passed" });
    }

    const alreadyRegistered = event.attendees.some(
      (attendee) => attendee.user.toString() === req.user.id
    );
    if (alreadyRegistered) {
      return res.status(400).json({ error: "You are already registered for this event" });
    }

    if (event.attendees.length >= event.capacity) {
      return res.status(400).json({ error: "Event registration is full" });
    }

    event.attendees.push({
      user: req.user.id,
      status: "registered",
      resultValue: null,
      rank: null,
      resultNote: "",
      resultEnteredAt: null,
      isDisqualified: false,
      checkInToken: generateCheckInToken(event._id, req.user.id),
    });
    await event.save();

    const populatedEvent = await Event.findById(event._id)
      .populate("createdBy", "username email role")
      .populate("attendees.user", "username email")
      .lean();

    const [serializedEvent] = await attachPublishedResultsToSerializedEvents([
      serializePublicEvent(populatedEvent),
    ]);

    res.status(201).json({
      message: "Registered successfully",
      event: serializedEvent,
    });
  } catch (err) {
    console.error("Event registration error:", err);
    res.status(500).json({ error: "Failed to register for event" });
  }
});

app.get("/participant/event-passes", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "participant") {
      return res.status(403).json({ error: "Only participants can access event passes" });
    }

    const events = await Event.find({
      attendees: {
        $elemMatch: {
          user: req.user.id,
        },
      },
    })
      .populate("createdBy", "username fullName email")
      .sort({ date: 1, createdAt: -1 });

    await finalizeCompletedEvents(events);

    let changed = false;
    const changedEvents = new Set();
    const now = new Date();

    const passes = events
      .map((event) => {
        try {
          if (ensureEventAttendeeTokens(event, req.user.id)) {
            changed = true;
            changedEvents.add(event);
          }

          const attendee = (event.attendees || []).find(
            (item) => getAttendeeUserId(item) === String(req.user.id)
          );

          if (!attendee) {
            return null;
          }

          const eventEndDate = getEventEndDate(event);
          if (hasEventPassExpired(event, now)) {
            if (clearExpiredEventPass(attendee, event, now)) {
              changed = true;
              changedEvents.add(event);
            }
            return null;
          }

          return {
            eventId: event._id,
            title: event.title,
            description: event.description,
            date: event.date,
            venue: event.venue,
            poster: event.poster,
            endedAt: event.endedAt,
            coordinatorName:
              event.createdBy?.fullName || event.createdBy?.username || "Coordinator",
            attendance: {
              status: attendee.status,
              checkedInAt: attendee.checkedInAt,
              checkInMethod: attendee.checkInMethod,
              checkInToken: attendee.checkInToken,
              isCheckInOpen: !hasEventEnded(event, now) && Boolean(eventEndDate && eventEndDate >= now),
            },
          };
        } catch (eventError) {
          console.error("Skipping malformed event pass record:", {
            eventId: event?._id,
            message: eventError?.message || eventError,
          });
          return null;
        }
      })
      .filter(Boolean);

    if (changed) {
      await Promise.allSettled(Array.from(changedEvents).map((event) => event.save()));
    }

    res.json(passes);
  } catch (err) {
    console.error("Participant event passes fetch error:", err);
    res.status(500).json({
      error: "Failed to load event passes",
      details: err?.message || "Unknown server error",
    });
  }
});

app.get("/participant/feedback-eligible", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "participant") {
      return res.status(403).json({ error: "Only participants can access feedback" });
    }

    const events = await Event.find({
      attendees: {
        $elemMatch: {
          user: req.user.id,
          status: "present",
        },
      },
    })
      .populate("createdBy", "username fullName email")
      .sort({ endDate: -1, endedAt: -1, createdAt: -1 });

    await finalizeCompletedEvents(events);

    const feedbackEntries = await Feedback.find({ participantId: req.user.id }).lean();
    const feedbackMap = new Map(
      feedbackEntries.map((entry) => [entry.eventId.toString(), entry])
    );

    const eligibleEvents = events
      .filter((event) => hasEventEnded(event))
      .map((event) => {
      const attendee = (event.attendees || []).find(
        (item) => item.user?.toString?.() === req.user.id && item.status === "present"
      );
      const feedback = feedbackMap.get(event._id.toString()) || null;

      return {
        eventId: event._id,
        title: event.title,
        description: event.description,
        date: event.date,
        venue: event.venue,
        poster: event.poster,
        endedAt: event.endedAt,
        coordinatorName:
          event.createdBy?.fullName || event.createdBy?.username || "Coordinator",
        attendanceStatus: attendee?.status || null,
        hasSubmittedFeedback: Boolean(feedback),
        feedback,
      };
      });

    res.json(eligibleEvents);
  } catch (err) {
    console.error("Participant feedback eligibility error:", err);
    res.status(500).json({ error: "Failed to load feedback-eligible events" });
  }
});

app.post("/events/:eventId/feedback", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "participant") {
      return res.status(403).json({ error: "Only participants can submit feedback" });
    }

    const { rating, comment = "", recommend = null } = req.body;
    const normalizedRating = Number(rating);

    if (!Number.isInteger(normalizedRating) || normalizedRating < 1 || normalizedRating > 5) {
      return res.status(400).json({ error: "Rating must be an integer between 1 and 5" });
    }

    if (typeof comment !== "string") {
      return res.status(400).json({ error: "Comment must be a string" });
    }

    if (comment.trim().length > 1000) {
      return res.status(400).json({ error: "Comment must not exceed 1000 characters" });
    }

    if (recommend !== null && typeof recommend !== "boolean") {
      return res.status(400).json({ error: "Recommend must be true, false, or null" });
    }

    const event = await Event.findOne({
      _id: req.params.eventId,
      attendees: {
        $elemMatch: {
          user: req.user.id,
          status: "present",
        },
      },
    }).select("title date endDate endedAt attendees");

    if (!event) {
      return res.status(404).json({
        error: "Completed event not found, or you are not eligible to submit feedback",
      });
    }

    if (finalizeCompletedEvent(event)) {
      await event.save();
    }

    if (!hasEventEnded(event)) {
      return res.status(400).json({ error: "Feedback can only be submitted after the event ends" });
    }

    const existingFeedback = await Feedback.findOne({
      eventId: req.params.eventId,
      participantId: req.user.id,
    });

    if (existingFeedback) {
      return res.status(400).json({ error: "Feedback already submitted for this event" });
    }

    const feedback = await Feedback.create({
      eventId: req.params.eventId,
      participantId: req.user.id,
      rating: normalizedRating,
      comment: comment.trim(),
      recommend,
    });

    res.status(201).json({
      message: "Feedback submitted successfully",
      feedback,
    });
  } catch (err) {
    console.error("Participant feedback submission error:", err);
    res.status(500).json({ error: "Failed to submit feedback" });
  }
});

app.patch("/events/:eventId/feedback", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "participant") {
      return res.status(403).json({ error: "Only participants can update feedback" });
    }

    const { rating, comment = "", recommend = null } = req.body;
    const normalizedRating = Number(rating);

    if (!Number.isInteger(normalizedRating) || normalizedRating < 1 || normalizedRating > 5) {
      return res.status(400).json({ error: "Rating must be an integer between 1 and 5" });
    }

    if (typeof comment !== "string") {
      return res.status(400).json({ error: "Comment must be a string" });
    }

    if (comment.trim().length > 1000) {
      return res.status(400).json({ error: "Comment must not exceed 1000 characters" });
    }

    if (recommend !== null && typeof recommend !== "boolean") {
      return res.status(400).json({ error: "Recommend must be true, false, or null" });
    }

    const event = await Event.findOne({
      _id: req.params.eventId,
      attendees: {
        $elemMatch: {
          user: req.user.id,
          status: "present",
        },
      },
    }).select("date endDate endedAt attendees");

    if (!event) {
      return res.status(404).json({
        error: "Completed event not found, or you are not eligible to update feedback",
      });
    }

    if (finalizeCompletedEvent(event)) {
      await event.save();
    }

    if (!hasEventEnded(event)) {
      return res.status(400).json({ error: "Feedback can only be updated after the event ends" });
    }

    const feedback = await Feedback.findOneAndUpdate(
      {
        eventId: req.params.eventId,
        participantId: req.user.id,
      },
      {
        rating: normalizedRating,
        comment: comment.trim(),
        recommend,
      },
      {
        new: true,
      }
    );

    if (!feedback) {
      return res.status(404).json({ error: "Feedback not found for this event" });
    }

    res.json({
      message: "Feedback updated successfully",
      feedback,
    });
  } catch (err) {
    console.error("Participant feedback update error:", err);
    res.status(500).json({ error: "Failed to update feedback" });
  }
});

app.get("/participant/certificates", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "participant") {
      return res.status(403).json({ error: "Only participants can access certificates" });
    }

    const events = await Event.find({
      attendees: {
        $elemMatch: {
          user: req.user.id,
          status: "present",
        },
      },
    })
      .sort({ endDate: -1, endedAt: -1, createdAt: -1 });

    await finalizeCompletedEvents(events);
    const certificates = await Certificate.find({ participantId: req.user.id })
      .sort({ issuedAt: -1, eventEndDate: -1, createdAt: -1 })
      .lean();

    if (certificates.length === 0) {
      return res.json([]);
    }

    const relatedEventIds = Array.from(
      new Set(certificates.map((certificate) => String(certificate.eventId || "")).filter(Boolean))
    );

    const relatedEvents = await Event.find({ _id: { $in: relatedEventIds } })
      .select("eventMode rankingConfig.resultsPublished")
      .lean();

    const eventMap = new Map(relatedEvents.map((event) => [String(event._id), event]));
    const visibleCertificates = certificates.filter((certificate) => {
      const event = eventMap.get(String(certificate.eventId || ""));
      if (!event) {
        return false;
      }

      if (normalizeEventMode(event.eventMode) !== "ranking") {
        return true;
      }

      return Boolean(event?.rankingConfig?.resultsPublished);
    });

    res.json(visibleCertificates);
  } catch (err) {
    console.error("Participant certificates fetch error:", err);
    res.status(500).json({ error: "Could not fetch certificates" });
  }
});

app.get("/coordinator/events/:eventId/feedback", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "coordinator") {
      return res.status(403).json({ error: "Only coordinators can access event feedback" });
    }

    const event = await Event.findOne({
      _id: req.params.eventId,
      createdBy: req.user.id,
    })
      .populate("createdBy", "username fullName email");

    if (!event) {
      return res.status(404).json({ error: "Event not found or not owned by coordinator" });
    }

    if (finalizeCompletedEvent(event)) {
      await event.save();
    }

    if (!hasEventEnded(event)) {
      return res.status(400).json({ error: "Feedback is only available after the event ends" });
    }

    const feedbackEntries = await Feedback.find({ eventId: req.params.eventId })
      .populate("participantId", "username fullName email department year profileImage")
      .sort({ createdAt: -1 })
      .lean();

    const ratingBreakdown = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let recommendationCount = 0;

    feedbackEntries.forEach((entry) => {
      if (ratingBreakdown[entry.rating] !== undefined) {
        ratingBreakdown[entry.rating] += 1;
      }
      if (entry.recommend === true) {
        recommendationCount += 1;
      }
    });

    const averageRating =
      feedbackEntries.length > 0
        ? Number(
            (
              feedbackEntries.reduce((sum, entry) => sum + entry.rating, 0) /
              feedbackEntries.length
            ).toFixed(1)
          )
        : 0;

    res.json({
      event: {
        _id: event._id,
        title: event.title,
        description: event.description,
        date: event.date,
        venue: event.venue,
        poster: event.poster,
        endedAt: event.endedAt,
        capacity: event.capacity,
        attendeeCount: (event.attendees || []).length,
      },
      summary: {
        totalResponses: feedbackEntries.length,
        averageRating,
        recommendationCount,
        recommendationRate:
          feedbackEntries.length > 0
            ? Number(((recommendationCount / feedbackEntries.length) * 100).toFixed(1))
            : 0,
        ratingBreakdown,
      },
      feedback: feedbackEntries.map((entry) => ({
        _id: entry._id,
        rating: entry.rating,
        comment: entry.comment,
        recommend: entry.recommend,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,
        participant: entry.participantId
          ? {
              _id: entry.participantId._id,
              username: entry.participantId.username,
              fullName: entry.participantId.fullName,
              email: entry.participantId.email,
              department: entry.participantId.department,
              year: entry.participantId.year,
              profileImage: entry.participantId.profileImage,
            }
          : null,
      })),
    });
  } catch (err) {
    console.error("Coordinator event feedback fetch error:", err);
    res.status(500).json({ error: "Failed to load event feedback" });
  }
});

io.use((socket, next) => {
  try {
    const authToken = socket.handshake.auth?.token || "";
    const headerToken = socket.handshake.headers?.authorization || "";
    const token = authToken || headerToken.replace("Bearer ", "");

    if (!token) {
      return next(new Error("No token provided"));
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    socket.user = decoded;
    next();
  } catch (err) {
    next(new Error("Invalid token"));
  }
});

io.on("connection", (socket) => {
  socket.join(`user:${socket.user.id}`);

  socket.on("conversation:join", async (conversationId) => {
    if (!conversationId) return;
    try {
      const conversation = await Conversation.findById(conversationId).select("participants");
      if (!conversation) return;

      const canJoin = conversation.participants.some(
        (participantId) => participantId.toString() === socket.user.id
      );
      if (canJoin) {
        socket.join(`conversation:${conversationId}`);
      }
    } catch (err) {
      console.error("Socket join error:", err.message);
    }
  });
});

const serializeConversation = (
  conversationDoc,
  currentUserId,
  lastMessageByConversation = {},
  sentMessageByConversation = {}
) => {
  const conversation = conversationDoc.toObject();
  const lastMessage = lastMessageByConversation[conversation._id.toString()] || null;

  return {
    ...conversation,
    lastMessage,
    hasSentMessage: sentMessageByConversation[conversation._id.toString()] || false,
    unreadCount: lastMessage
      ? lastMessage.readBy?.some((readerId) => readerId.toString() === currentUserId)
        ? 0
        : 1
      : 0,
  };
};

app.get("/coordinator/participants/:id", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "coordinator") {
      return res.status(403).json({ error: "Only coordinators can access this" });
    }

    const participant = await User.findById(req.params.id).select("-password");

    if (!participant) {
      return res.status(404).json({ error: "Participant not found" });
    }

    res.json(participant);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch participant" });
  }
});



// =========================
// EVENTS
// =========================
app.post("/events", verifyToken, upload.single("poster"), async (req, res) => {
  try {
    if (req.user.role !== "coordinator") {
      return res.status(403).json({ error: "Only coordinators can create events" });
    }

    const eventDate = new Date(req.body.date);
    const eventEndDate = new Date(req.body.endDate);

    if (Number.isNaN(eventDate.getTime())) {
      return res.status(400).json({ error: "Invalid event date" });
    }

    if (Number.isNaN(eventEndDate.getTime())) {
      return res.status(400).json({ error: "Invalid event end date" });
    }

    if (eventEndDate <= eventDate) {
      return res.status(400).json({ error: "Event end date must be after the start date" });
    }

    if (!req.body.venueId || !mongoose.Types.ObjectId.isValid(req.body.venueId)) {
      return res.status(400).json({ error: "Please select a valid venue" });
    }

    const venueRecord = await Venue.findOne({
      _id: req.body.venueId,
      isActive: true,
    });

    if (!venueRecord) {
      return res.status(404).json({ error: "Selected venue was not found" });
    }

    const requestedCapacity = Number(req.body.capacity);
    if (!Number.isFinite(requestedCapacity) || requestedCapacity < 1) {
      return res.status(400).json({ error: "Capacity must be at least 1" });
    }

    if (venueRecord.capacity && requestedCapacity > venueRecord.capacity) {
      return res.status(400).json({
        error: `Event capacity cannot exceed venue capacity of ${venueRecord.capacity}.`,
      });
    }

    const existingEvent = await Event.findOne({
      $and: [
        {
          $or: [
            { venueId: venueRecord._id },
            { venue: { $regex: `^${escapeRegex(venueRecord.name)}$`, $options: "i" } },
          ],
        },
        { date: { $lte: eventEndDate } },
        {
          $or: [
            { endDate: { $gte: eventDate } },
            { endDate: null, date: { $gte: eventDate } },
            { endDate: { $exists: false }, date: { $gte: eventDate } },
          ],
        },
      ],
    }).lean();

    if (existingEvent) {
      return res.status(409).json({
        error: `Venue "${venueRecord.name}" is already booked during the selected time range.`,
      });
    }

    const normalizedRankingConfig = normalizeRankingConfigInput(req.body);

    const eventData = {
      ...req.body,
      date: eventDate,
      endDate: eventEndDate,
      venue: venueRecord.name,
      venueId: venueRecord._id,
      capacity: requestedCapacity,
      eventMode: normalizedRankingConfig.eventMode,
      rankingConfig: normalizedRankingConfig.rankingConfig,
      poster: req.file ? req.file.filename : null,
      createdBy: req.user.id
    };

    const event = await Event.create(eventData);
    res.status(201).json(event);
  } catch (err) {
    console.error("Create Event Error:", err);
    if (err?.code === 11000) {
      return res.status(409).json({ error: "That venue is already booked for the selected date and time" });
    }

    res.status(400).json({ error: err.message });
  }
});

app.delete("/events/:id", verifyToken, requireAdmin, async (req, res) => {
  try {
    await EventResult.deleteMany({ eventId: req.params.id });
    await Certificate.deleteMany({ eventId: req.params.id });
    await Event.findByIdAndDelete(req.params.id);
    res.json({ message: "Event deleted" });
  } catch {
    res.status(500).json({ error: "Delete failed" });
  }
});

// =========================
// COORDINATOR PARTICIPANTS
// =========================
app.get("/coordinator/participants", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "coordinator") {
      return res.status(403).json({ error: "Only coordinators can access this" });
    }

    const participants = await User.find({}, "-password");
    res.json(participants);
  } catch (err) {
    res.status(500).json({ error: "Could not fetch participants" });
  }
});

// =========================
// REPORT FEATURE
// =========================

// Coordinator submits a report
app.post("/reports", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "coordinator") {
      return res.status(403).json({ error: "Only coordinators can submit reports" });
    }

    const { participantId, reason } = req.body;
    if (!participantId || !reason) {
      return res.status(400).json({ error: "Participant and reason are required" });
    }

    const newReport = new Report({
      participantId,
      coordinatorId: req.user.id,
      reason
    });

    await newReport.save();
    res.status(201).json({ message: "Report submitted successfully", report: newReport });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to submit report" });
  }
});

// Admin views all reports
app.get("/reports", verifyToken, requireAdmin, async (req, res) => {
  try {
    const reports = await Report.find()
      .populate("participantId", "username email isBanned bannedUntil")
      .populate("coordinatorId", "username email");
    res.json(reports);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch reports" });
  }
});

// Admin updates report status
app.patch("/reports/:id", verifyToken, requireAdmin, async (req, res) => {
  try {
    const { status } = req.body; // pending, reviewed, action_taken

    const report = await Report.findById(req.params.id);
    if (!report) return res.status(404).json({ error: "Report not found" });

    if (status) report.status = status;
    await report.save();

    res.json({ message: "Report updated successfully", report });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update report" });
  }
});

// Admin bans a reported participant until a specific date/time
app.patch("/reports/:id/ban-participant", verifyToken, requireAdmin, async (req, res) => {
  try {
    const { bannedUntil, permanent, reason } = req.body;
    let banUntilDate = null;

    if (!permanent) {
      if (!bannedUntil) {
        return res.status(400).json({ error: "bannedUntil is required for temporary bans" });
      }

      banUntilDate = new Date(bannedUntil);
      if (Number.isNaN(banUntilDate.getTime())) {
        return res.status(400).json({ error: "Invalid bannedUntil date" });
      }

      if (banUntilDate <= new Date()) {
        return res.status(400).json({ error: "Ban end time must be in the future" });
      }
    }

    const report = await Report.findById(req.params.id);
    if (!report) return res.status(404).json({ error: "Report not found" });

    const participant = await User.findById(report.participantId);
    if (!participant) return res.status(404).json({ error: "Participant not found" });

    participant.isBanned = true;
    participant.bannedUntil = permanent ? null : banUntilDate;
    participant.banReason = reason || `Banned via report ${report._id}`;
    await participant.save();

    report.status = "action_taken";
    await report.save();

    res.json({
      message: "Participant banned successfully",
      report,
      participant: {
        _id: participant._id,
        username: participant.username,
        email: participant.email,
        isBanned: participant.isBanned,
        bannedUntil: participant.bannedUntil
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to ban participant" });
  }
});



// =========================
// SERVER START
// =========================
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
