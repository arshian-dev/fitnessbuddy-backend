let wgerCache = null;

async function fetchWgerData() {
  if (wgerCache) return wgerCache;

  console.log('Fetching Wger exercise database... This might take a moment.');
  try {
    // We use dynamic import for node-fetch if global fetch is not available, but Node 18+ has global fetch.
    const response = await fetch('https://wger.de/api/v2/exerciseinfo/?language=2&limit=1000');
    
    if (!response.ok) {
      throw new Error(`Wger API responded with status: ${response.status}`);
    }

    const data = await response.json();
    
    wgerCache = data.results.map(ex => {
      // Find English translation for the name
      let exerciseName = ex.name;
      if (!exerciseName && ex.translations && ex.translations.length > 0) {
        const enTranslation = ex.translations.find(t => t.language === 2);
        exerciseName = enTranslation ? enTranslation.name : ex.translations[0].name;
      }

      return {
        id: ex.id,
        name: exerciseName || 'Unknown Exercise',
        images: ex.images || [],
        videos: ex.videos || []
      };
    });

    console.log(`Successfully cached ${wgerCache.length} exercises from Wger.`);
    return wgerCache;
  } catch (error) {
    console.error('Failed to fetch Wger data:', error.message);
    return []; // Return empty array so it doesn't crash, but don't cache null if we want to retry?
    // Actually, setting wgerCache to [] will prevent retries. Let's leave wgerCache = null on error.
  }
}

async function searchWger(query) {
  if (!wgerCache) {
    await fetchWgerData();
  }
  
  if (!wgerCache) return [];

  const q = query.toLowerCase().trim();
  const words = q.split(/[\s-]+/).map(w => w.replace(/s$/, ''));
  
  // Calculate a match score for each exercise
  const scoredResults = wgerCache.map(ex => {
    const n = ex.name.toLowerCase();
    let score = 0;
    
    // Exact match gets highest score
    if (n === q) score += 100;
    if (n.includes(q)) score += 50;

    // Add points for each word matched
    for (const w of words) {
      if (w.length > 2 && n.includes(w)) {
        score += 10;
      }
    }
    
    return { ...ex, score };
  });

  // Filter out those with 0 score and sort
  const matches = scoredResults
    .filter(ex => ex.score > 0)
    .sort((a, b) => b.score - a.score);

  // Return the original objects without the score field if desired, or keep it
  return matches;
}

// Pre-warm the cache
fetchWgerData().catch(err => console.error("Wger Cache init error:", err));

module.exports = {
  fetchWgerData,
  searchWger
};
