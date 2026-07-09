const express = require('express');
const router = express.Router();
const db = require('../db/db');

// Add friend request
router.post('/friends/request', async (req, res) => {
    try {
        const { userId, friendId } = req.body;
        // Check if a friendship already exists
        const check = await db.query(
            'SELECT * FROM friendships WHERE (user_id_1 = $1 AND user_id_2 = $2) OR (user_id_1 = $2 AND user_id_2 = $1)',
            [userId, friendId]
        );
        if (check.rows.length > 0) {
            return res.status(400).json({ error: 'Friendship or request already exists' });
        }
        await db.query(
            'INSERT INTO friendships (user_id_1, user_id_2, status) VALUES ($1, $2, $3)',
            [userId, friendId, 'PENDING']
        );
        res.json({ message: 'Friend request sent' });
    } catch (err) {
        console.error('Error sending friend request:', err);
        res.status(500).json({ error: err.message });
    }
});

// Accept friend request
router.post('/friends/accept', async (req, res) => {
    try {
        const { userId, friendId } = req.body;
        await db.query(
            'UPDATE friendships SET status = $1 WHERE user_id_1 = $2 AND user_id_2 = $3 AND status = $4',
            ['ACCEPTED', friendId, userId, 'PENDING'] // Note: user_id_1 is the sender, user_id_2 is the receiver
        );
        res.json({ message: 'Friend request accepted' });
    } catch (err) {
        console.error('Error accepting friend request:', err);
        res.status(500).json({ error: err.message });
    }
});

// Get friends (accepted and pending)
router.get('/friends/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const friends = await db.query(
            `SELECT u.id, u.name, u.email, f.status, 
                CASE WHEN f.user_id_1 = $1 THEN 'SENT' ELSE 'RECEIVED' END as request_type
             FROM friendships f
             JOIN users u ON (f.user_id_1 = u.id AND f.user_id_2 = $1) OR (f.user_id_2 = u.id AND f.user_id_1 = $1)
             WHERE f.user_id_1 = $1 OR f.user_id_2 = $1`,
            [userId]
        );
        res.json(friends.rows);
    } catch (err) {
        console.error('Error fetching friends:', err);
        res.status(500).json({ error: err.message });
    }
});

// Create post
router.post('/posts', async (req, res) => {
    try {
        const { userId, content, postType, referenceId, imageUris } = req.body;
        const newPost = await db.query(
            `INSERT INTO posts (user_id, content, post_type, reference_id, image_uris) 
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [userId, content, postType || 'TEXT', referenceId || null, imageUris || []]
        );
        res.json(newPost.rows[0]);
    } catch (err) {
        console.error('Error creating post:', err);
        res.status(500).json({ error: err.message });
    }
});

// Get Feed (from friends + user's own posts)
router.get('/feed/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        
        // Find friend IDs
        const friends = await db.query(
            `SELECT CASE WHEN user_id_1 = $1 THEN user_id_2 ELSE user_id_1 END as friend_id
             FROM friendships 
             WHERE (user_id_1 = $1 OR user_id_2 = $1) AND status = 'ACCEPTED'`,
            [userId]
        );
        const friendIds = friends.rows.map(r => r.friend_id);
        const allUserIds = [userId, ...friendIds];

        const posts = await db.query(
            `SELECT p.*, u.name as author_name,
               (SELECT COUNT(*) FROM likes WHERE post_id = p.id) as likes_count,
               (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comments_count,
               EXISTS(SELECT 1 FROM likes WHERE post_id = p.id AND user_id = $1) as user_liked,
               wp.split as workout_split, wp.frequency as workout_frequency, wp.exercises as workout_exercises,
               pl.weight as log_weight, pl.energy_score as log_energy, pl.mood_score as log_mood
             FROM posts p
             JOIN users u ON p.user_id = u.id
             LEFT JOIN workout_plans wp ON p.reference_id = wp.id AND p.post_type = 'WORKOUT'
             LEFT JOIN progress_logs pl ON p.reference_id = pl.id AND p.post_type = 'PROGRESS_LOG'
             WHERE p.user_id = ANY($2::uuid[])
             ORDER BY p.created_at DESC
             LIMIT 50`,
            [userId, allUserIds]
        );
        res.json(posts.rows);
    } catch (err) {
        console.error('Error fetching feed:', err);
        res.status(500).json({ error: err.message });
    }
});

// Like a post
router.post('/posts/:postId/like', async (req, res) => {
    try {
        const { postId } = req.params;
        const { userId } = req.body;
        
        // Check if already liked
        const check = await db.query('SELECT * FROM likes WHERE post_id = $1 AND user_id = $2', [postId, userId]);
        if (check.rows.length > 0) {
            // Unlike
            await db.query('DELETE FROM likes WHERE post_id = $1 AND user_id = $2', [postId, userId]);
            return res.json({ liked: false });
        } else {
            // Like
            await db.query('INSERT INTO likes (post_id, user_id) VALUES ($1, $2)', [postId, userId]);
            return res.json({ liked: true });
        }
    } catch (err) {
        console.error('Error toggling like:', err);
        res.status(500).json({ error: err.message });
    }
});

// Add comment
router.post('/posts/:postId/comment', async (req, res) => {
    try {
        const { postId } = req.params;
        const { userId, content } = req.body;
        
        const comment = await db.query(
            'INSERT INTO comments (post_id, user_id, content) VALUES ($1, $2, $3) RETURNING *',
            [postId, userId, content]
        );
        res.json(comment.rows[0]);
    } catch (err) {
        console.error('Error adding comment:', err);
        res.status(500).json({ error: err.message });
    }
});

// Get comments for a post
router.get('/posts/:postId/comments', async (req, res) => {
    try {
        const { postId } = req.params;
        const comments = await db.query(
            `SELECT c.*, u.name as author_name 
             FROM comments c 
             JOIN users u ON c.user_id = u.id 
             WHERE c.post_id = $1 
             ORDER BY c.created_at ASC`,
            [postId]
        );
        res.json(comments.rows);
    } catch (err) {
        console.error('Error fetching comments:', err);
        res.status(500).json({ error: err.message });
    }
});

// Get all users (to find friends)
router.get('/users/search', async (req, res) => {
    try {
        const { q, excludeId } = req.query;
        // Search by name or email
        let queryStr = `SELECT id, name, email FROM users WHERE id != $1 AND role = 'CLIENT'`;
        const params = [excludeId];
        
        if (q) {
            queryStr += ` AND (name ILIKE $2 OR email ILIKE $2)`;
            params.push(`%${q}%`);
        }
        queryStr += ` LIMIT 20`;
        
        const users = await db.query(queryStr, params);
        res.json(users.rows);
    } catch (err) {
        console.error('Error searching users:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
