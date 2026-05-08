const express = require('express');
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Share list with user
router.post('/', authenticateToken, async (req, res) => {
  const { shopping_list_id, email, can_edit } = req.body;
  const userId = req.user.id;

  if (!shopping_list_id || !email) {
    return res.status(400).json({ error: 'List ID and email are required' });
  }

  try {
    // Check if list exists and user is owner
    const [lists] = await db.query(
      'SELECT owner_id FROM shopping_lists WHERE id = ?',
      [shopping_list_id]
    );

    if (lists.length === 0) {
      return res.status(404).json({ error: 'List not found' });
    }

    if (lists[0].owner_id !== userId) {
      return res.status(403).json({ error: 'Only owner can share the list' });
    }

    // Find user to share with
    const [users] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const sharedWithUserId = users[0].id;

    if (sharedWithUserId === userId) {
      return res.status(400).json({ error: 'Cannot share list with yourself' });
    }

    // Add share record
    await db.query(
      'INSERT INTO shared_lists (shopping_list_id, shared_with_user_id, can_edit) VALUES (?, ?, ?)',
      [shopping_list_id, sharedWithUserId, can_edit || 0]
    );

    res.json({ message: 'List shared successfully' });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'List already shared with this user' });
    }
    console.error(error);
    res.status(500).json({ error: 'Failed to share list' });
  }
});

// Get all users shared with for a list
router.get('/:listId', authenticateToken, async (req, res) => {
  const listId = req.params.listId;
  const userId = req.user.id;

  try {
    const [lists] = await db.query(
      'SELECT owner_id FROM shopping_lists WHERE id = ?',
      [listId]
    );

    if (lists.length === 0) {
      return res.status(404).json({ error: 'List not found' });
    }

    if (lists[0].owner_id !== userId) {
      return res.status(403).json({ error: 'Only owner can view shared users' });
    }

    const [shared] = await db.query(`
      SELECT sh.*, u.email 
      FROM shared_lists sh
      JOIN users u ON sh.shared_with_user_id = u.id
      WHERE sh.shopping_list_id = ?
    `, [listId]);

    res.json(shared);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch shared users' });
  }
});

// Remove share access
router.delete('/:listId/:userId', authenticateToken, async (req, res) => {
  const { listId, userId: sharedWithUserId } = req.params;
  const ownerId = req.user.id;

  try {
    const [lists] = await db.query(
      'SELECT owner_id FROM shopping_lists WHERE id = ?',
      [listId]
    );

    if (lists.length === 0) {
      return res.status(404).json({ error: 'List not found' });
    }

    if (lists[0].owner_id !== ownerId) {
      return res.status(403).json({ error: 'Only owner can remove share access' });
    }

    await db.query(
      'DELETE FROM shared_lists WHERE shopping_list_id = ? AND shared_with_user_id = ?',
      [listId, sharedWithUserId]
    );

    res.json({ message: 'Share access removed successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to remove share access' });
  }
});

module.exports = router;