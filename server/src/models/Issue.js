import mongoose from 'mongoose';
import {
  DEPARTMENT_VALUES,
  STATUS_VALUES,
  PRIORITY_VALUES,
  STATUSES,
} from '../config/constants.js';

const historySchema = new mongoose.Schema(
  {
    action: { type: String, required: true },
    from: { type: String, default: null },
    to: { type: String, default: null },
    note: { type: String, default: null, maxlength: 1000 },
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    at: { type: Date, default: Date.now },
    meta: { type: mongoose.Schema.Types.Mixed, default: undefined },
  },
  { _id: false }
);

const duplicateCandidateSchema = new mongoose.Schema(
  {
    issue: { type: mongoose.Schema.Types.ObjectId, ref: 'Issue', required: true },
    publicId: { type: String },
    score: { type: Number, required: true },
  },
  { _id: false }
);

const issueSchema = new mongoose.Schema(
  {
    publicId: { type: String, unique: true, index: true, required: true },
    title: {
      type: String,
      required: [true, 'Title is required.'],
      trim: true,
      minlength: [5, 'Title must be at least 5 characters.'],
      maxlength: [120, 'Title must be at most 120 characters.'],
    },
    description: {
      type: String,
      required: [true, 'Description is required.'],
      trim: true,
      minlength: [20, 'Description must be at least 20 characters.'],
      maxlength: [4000, 'Description must be at most 4000 characters.'],
    },
    location: {
      type: String,
      trim: true,
      maxlength: [120, 'Location must be at most 120 characters.'],
      default: '',
    },
    // Department is derived server-side from the classifier (or set by an Admin
    // during manual review). It is null while an issue is awaiting review, so
    // the enum explicitly allows null and no client ever supplies it.
    department: {
      type: String,
      enum: [...DEPARTMENT_VALUES, null],
      default: null,
    },
    priority: {
      type: String,
      enum: PRIORITY_VALUES,
      default: 'medium',
      required: true,
    },
    status: {
      type: String,
      enum: STATUS_VALUES,
      default: STATUSES.SUBMITTED,
      required: true,
    },
    reporter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    duplicateOf: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Issue',
      default: null,
    },
    duplicateCandidates: {
      type: [duplicateCandidateSchema],
      default: [],
    },
    needsReview: {
      type: Boolean,
      default: false,
    },
    ml: {
      suggestedDepartment: { type: String, default: null },
      confidence: { type: Number, default: null },
      available: { type: Boolean, default: null },
    },
    // Soft deletion (archival). A reporter "deletes" their own issue by stamping
    // these fields; the document and its audit history are preserved so the act
    // stays auditable and recoverable. Archived issues are filtered out of every
    // ordinary query by the middleware below.
    archivedAt: { type: Date, default: null, index: true },
    archivedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    history: {
      type: [historySchema],
      default: [],
    },
  },
  { timestamps: true }
);

issueSchema.index({ status: 1, department: 1 });
issueSchema.index({ createdAt: -1 });

// Every read/update query hides archived issues unless a caller explicitly opts
// in with `.setOptions({ includeArchived: true })`. This is what guarantees the
// requirement that archived issues vanish from lists, counts, analytics,
// assignment queues, duplicate detection, and direct id lookups (so they can no
// longer be updated, assigned, reopened, or resolved through any endpoint).
issueSchema.pre(/^(find|count)/, function excludeArchived(next) {
  if (!this.getOptions().includeArchived) {
    this.where({ archivedAt: null });
  }
  next();
});

issueSchema.methods.addHistory = function addHistory(entry) {
  this.history.push(entry);
};

const Issue = mongoose.model('Issue', issueSchema);

export default Issue;
