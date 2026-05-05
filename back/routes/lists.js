const express = require('express');
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Get all lists for a user (owned + shared)
router.get('/', authenticateToken, async (req, res) => {
  const userId = req.user.id;

  try {
    // Owned lists
    const [ownedLists] = await db.query(`
      SELECT sl.*, u.email as owner_email, 'owner' as role
      FROM shopping_lists sl
      JOIN users u ON sl.owner_id = u.id
      WHERE sl.owner_id = ?
      ORDER BY sl.updated_at DESC
    `, [userId]);

    // Shared lists
    const [sharedLists] = await db.query(`
      SELECT sl.*, u.email as owner_email, 'shared' as role, sh.can_edit
      FROM shared_lists sh
      JOIN shopping_lists sl ON sh.shopping_list_id = sl.id
      JOIN users u ON sl.owner_id = u.id
      WHERE sh.shared_with_user_id = ?
      ORDER BY sl.updated_at DESC
    `, [userId]);

    res.json({ ownedLists, sharedLists });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch lists' });
  }
});

// Create a new list
router.post('/', authenticateToken, async (req, res) => {
  const { name } = req.body;
  const userId = req.user.id;

  if (!name) {
    return res.status(400).json({ error: 'List name is required' });
  }

  try {
    const [result] = await db.query(
      'INSERT INTO shopping_lists (owner_id, name) VALUES (?, ?)',
      [userId, name]
    );

    const [newList] = await db.query(`
      SELECT sl.*, u.email as owner_email
      FROM shopping_lists sl
      JOIN users u ON sl.owner_id = u.id
      WHERE sl.id = ?
    `, [result.insertId]);

    res.json({ list: newList[0], role: 'owner' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create list' });
  }
});

// Update list name
router.put('/:id', authenticateToken, async (req, res) => {
  const listId = req.params.id;
  const { name } = req.body;
  const userId = req.user.id;

  try {
    // Check permissions
    const [lists] = await db.query(
      'SELECT owner_id FROM shopping_lists WHERE id = ?',
      [listId]
    );

    if (lists.length === 0) {
      return res.status(404).json({ error: 'List not found' });
    }

    const isOwner = lists[0].owner_id === userId;
    if (!isOwner) {
      const [shared] = await db.query(
        'SELECT can_edit FROM shared_lists WHERE shopping_list_id = ? AND shared_with_user_id = ?',
        [listId, userId]
      );
      if (shared.length === 0 || !shared[0].can_edit) {
        return res.status(403).json({ error: 'No permission to edit this list' });
      }
    }

    await db.query('UPDATE shopping_lists SET name = ? WHERE id = ?', [name, listId]);
    res.json({ message: 'List updated successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update list' });
  }
});

// Delete list
router.delete('/:id', authenticateToken, async (req, res) => {
  const listId = req.params.id;
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
      return res.status(403).json({ error: 'Only owner can delete the list' });
    }

    await db.query('DELETE FROM shopping_lists WHERE id = ?', [listId]);
    res.json({ message: 'List deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to delete list' });
  }
});

// Get list items
router.get('/:id/items', authenticateToken, async (req, res) => {
  const listId = req.params.id;
  const userId = req.user.id;

  try {
    // Check access
    const [lists] = await db.query(
      'SELECT owner_id FROM shopping_lists WHERE id = ?',
      [listId]
    );

    if (lists.length === 0) {
      return res.status(404).json({ error: 'List not found' });
    }

    const hasAccess = lists[0].owner_id === userId;
    if (!hasAccess) {
      const [shared] = await db.query(
        'SELECT id FROM shared_lists WHERE shopping_list_id = ? AND shared_with_user_id = ?',
        [listId, userId]
      );
      if (shared.length === 0) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    const [items] = await db.query(
      'SELECT * FROM list_items WHERE shopping_list_id = ? ORDER BY created_at ASC',
      [listId]
    );

    res.json(items);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch items' });
  }
});

module.exports = router;