import mongoose from 'mongoose';

const TypistSchema = new mongoose.Schema({
    // Inherits from User model - this is just for reference
    // The typist is actually stored in the User collection with role: 'typist'
    
    // Specific typist configurations
    linkedRadiologist: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    
    // Typing statistics
    stats: {
        reportsTyped: { type: Number, default: 0 },
        wordsTyped: { type: Number, default: 0 },
        avgTypingSpeed: { type: Number, default: 0 }, // words per minute
        totalWorkingTime: { type: Number, default: 0 }, // in minutes
        lastActiveAt: { type: Date }
    },
    
    // Preferences
    preferences: {
        defaultFont: { type: String, default: 'Arial' },
        fontSize: { type: Number, default: 12 },
        autoSave: { type: Boolean, default: true },
        keyboardShortcuts: { type: Boolean, default: true }
    }
}, {
    timestamps: true,
    collection: 'typists'
});

// Indexes
TypistSchema.index({ linkedRadiologist: 1 });
TypistSchema.index({ 'stats.lastActiveAt': 1 });

const Typist = mongoose.model('Typist', TypistSchema);
export default Typist;