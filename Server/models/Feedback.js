const mongoose = require("mongoose");

const feedbackSchema = new mongoose.Schema(
  {
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: true,
    },
    participantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    comment: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "",
    },
    recommend: {
      type: Boolean,
      default: null,
    },
  },
  { timestamps: true }
);

feedbackSchema.index({ eventId: 1, participantId: 1 }, { unique: true });

module.exports = mongoose.model("Feedback", feedbackSchema);
