const mongoose = require("mongoose");

const eventResultSchema = new mongoose.Schema(
  {
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: true,
      index: true,
    },
    participantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    attendeeId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    rank: {
      type: Number,
      required: true,
      min: 1,
    },
    note: {
      type: String,
      default: "",
      trim: true,
    },
    publishedAt: {
      type: Date,
      default: null,
    },
    publishedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

eventResultSchema.index({ eventId: 1, participantId: 1 }, { unique: true });
eventResultSchema.index({ eventId: 1, rank: 1 }, { unique: true });

module.exports = mongoose.model("EventResult", eventResultSchema);
