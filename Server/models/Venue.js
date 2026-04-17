const mongoose = require("mongoose");

const normalizeVenueName = (value = "") =>
  value
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();

const venueSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    normalizedName: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    location: {
      type: String,
      default: "",
      trim: true,
    },
    description: {
      type: String,
      default: "",
      trim: true,
    },
    capacity: {
      type: Number,
      default: null,
      min: 1,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

venueSchema.pre("validate", function setNormalizedName() {
  if (typeof this.name === "string") {
    this.name = this.name.trim().replace(/\s+/g, " ");
  }

  this.normalizedName = normalizeVenueName(this.name);
});

module.exports = mongoose.model("Venue", venueSchema);
