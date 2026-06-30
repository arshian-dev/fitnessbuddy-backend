const db = require('../db/db');

async function migrate() {
  try {
    console.log('Enabling pgvector extension...');
    await db.query('CREATE EXTENSION IF NOT EXISTS vector;');
    
    console.log('Altering knowledge_base table to use vector(1536)...');
    await db.query(`
      ALTER TABLE knowledge_base 
      ALTER COLUMN embedding TYPE vector(1536) 
      USING (embedding::text::vector);
    `);
    
    console.log('Creating HNSW index...');
    await db.query(`
      CREATE INDEX IF NOT EXISTS knowledge_base_embedding_idx 
      ON knowledge_base 
      USING hnsw (embedding vector_cosine_ops);
    `);
    
    console.log('Migration successful!');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    process.exit(0);
  }
}

migrate();
