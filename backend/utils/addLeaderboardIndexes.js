const { query } = require("./db");

async function addLeaderboardIndexes() {
  console.log("Adding database indexes for leaderboard performance optimization...");
  
  try {
    // Indexes for quiz_attempts
    await query(`CREATE INDEX IF NOT EXISTS idx_quiz_attempts_school_term_learner ON quiz_attempts(school_id, term_id, learner_id)`);
    console.log("✓ Added index on quiz_attempts(school_id, term_id, learner_id)");
    
    await query(`CREATE INDEX IF NOT EXISTS idx_quiz_attempts_school_term_created ON quiz_attempts(school_id, term_id, created_at)`);
    console.log("✓ Added index on quiz_attempts(school_id, term_id, created_at)");
    
    await query(`CREATE INDEX IF NOT EXISTS idx_quiz_attempts_school_term_score ON quiz_attempts(school_id, term_id, score)`);
    console.log("✓ Added index on quiz_attempts(school_id, term_id, score)");
    
    // Indexes for typing_results
    await query(`CREATE INDEX IF NOT EXISTS idx_typing_results_school_term_learner ON typing_results(school_id, term_id, learner_id)`);
    console.log("✓ Added index on typing_results(school_id, term_id, learner_id)");
    
    await query(`CREATE INDEX IF NOT EXISTS idx_typing_results_school_term_created ON typing_results(school_id, term_id, created_at)`);
    console.log("✓ Added index on typing_results(school_id, term_id, created_at)");
    
    await query(`CREATE INDEX IF NOT EXISTS idx_typing_results_school_term_wpm ON typing_results(school_id, term_id, wpm)`);
    console.log("✓ Added index on typing_results(school_id, term_id, wpm)");
    
    // Indexes for typing_attempts
    await query(`CREATE INDEX IF NOT EXISTS idx_typing_attempts_school_term_learner ON typing_attempts(school_id, term_id, learner_id)`);
    console.log("✓ Added index on typing_attempts(school_id, term_id, learner_id)");
    
    await query(`CREATE INDEX IF NOT EXISTS idx_typing_attempts_school_term_created ON typing_attempts(school_id, term_id, created_at)`);
    console.log("✓ Added index on typing_attempts(school_id, term_id, created_at)");
    
    await query(`CREATE INDEX IF NOT EXISTS idx_typing_attempts_school_term_wpm ON typing_attempts(school_id, term_id, wpm)`);
    console.log("✓ Added index on typing_attempts(school_id, term_id, wpm)");
    
    // Indexes for leaderboard_entries
    await query(`CREATE INDEX IF NOT EXISTS idx_leaderboard_entries_school_term_type ON leaderboard_entries(school_id, term_id, leaderboard_type)`);
    console.log("✓ Added index on leaderboard_entries(school_id, term_id, leaderboard_type)");
    
    await query(`CREATE INDEX IF NOT EXISTS idx_leaderboard_entries_school_term_learner ON leaderboard_entries(school_id, term_id, learner_id)`);
    console.log("✓ Added index on leaderboard_entries(school_id, term_id, learner_id)");
    
    await query(`CREATE INDEX IF NOT EXISTS idx_leaderboard_entries_school_term_score ON leaderboard_entries(school_id, term_id, score)`);
    console.log("✓ Added index on leaderboard_entries(school_id, term_id, score)");
    
    // Composite indexes for common query patterns
    await query(`CREATE INDEX IF NOT EXISTS idx_quiz_attempts_composite ON quiz_attempts(school_id, term_id, learner_id, score, created_at)`);
    console.log("✓ Added composite index on quiz_attempts(school_id, term_id, learner_id, score, created_at)");
    
    await query(`CREATE INDEX IF NOT EXISTS idx_typing_results_composite ON typing_results(school_id, term_id, learner_id, wpm, created_at)`);
    console.log("✓ Added composite index on typing_results(school_id, term_id, learner_id, wpm, created_at)");
    
    await query(`CREATE INDEX IF NOT EXISTS idx_typing_attempts_composite ON typing_attempts(school_id, term_id, learner_id, wpm, created_at)`);
    console.log("✓ Added composite index on typing_attempts(school_id, term_id, learner_id, wpm, created_at)");
    
    console.log("\n✅ All leaderboard indexes added successfully!");
  } catch (error) {
    console.error("Error adding indexes:", error);
    process.exit(1);
  }
}

if (require.main === module) {
  addLeaderboardIndexes().then(() => process.exit(0));
}

module.exports = { addLeaderboardIndexes };
