const mongoose = require("mongoose");

const attendeeSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ["registered", "present", "absent"],
      default: "registered",
    },
    certificateIssuedAt: {
      type: Date,
      default: null,
    },
    certificateNumber: {
      type: String,
      default: "",
    },
    checkInToken: {
      type: String,
      default: "",
    },
    checkedInAt: {
      type: Date,
      default: null,
    },
    checkedInBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    checkInMethod: {
      type: String,
      enum: ["manual", "bulk", "scanner"],
      default: null,
    },
    resultValue: {
      type: Number,
      default: null,
    },
    rank: {
      type: Number,
      default: null,
    },
    resultNote: {
      type: String,
      default: "",
      trim: true,
    },
    resultEnteredAt: {
      type: Date,
      default: null,
    },
    isDisqualified: {
      type: Boolean,
      default: false,
    },
  },
  { _id: true }
);

const eventSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },

    date: { type: Date, required: true }, // Event start datetime
    endDate: { type: Date, required: true }, // Event end datetime
    venue: { type: String, required: true, trim: true },
    venueId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Venue",
      required: true,
      index: true,
    },
    capacity: { type: Number, required: true, min: 1 },

    registrationDeadline: {
      type: Date,
      required: true,
    },

    poster: {
      type: String, // store filename (e.g., 1728391823.jpg)
    },

    eventMode: {
      type: String,
      enum: ["standard", "ranking"],
      default: "standard",
    },
    rankingConfig: {
      metricLabel: {
        type: String,
        default: "",
        trim: true,
      },
      metricUnit: {
        type: String,
        default: "",
        trim: true,
      },
      rankingOrder: {
        type: String,
        enum: ["higher", "lower"],
        default: "higher",
      },
      resultsPublished: {
        type: Boolean,
        default: false,
      },
    },

    attendees: [attendeeSchema],

    endedAt: {
      type: Date,
      default: null,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

eventSchema.pre("validate", function ensureEndDate() {
  if (!this.endDate && this.date) {
    this.endDate = this.date;
  }
});

eventSchema.index(
  { venueId: 1, date: 1 },
  {
    unique: true,
    partialFilterExpression: { venueId: { $exists: true } },
  }
);

module.exports = mongoose.model("Event", eventSchema);
