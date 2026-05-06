const express = require('express');
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Add item to list
router.post('/', authenticateToken, async (req, res) => {
  const { shopping_list_id, name, quantity } = req.body;
  const userId = req.user.id;

  if (!shopping_list_id || !name) {
    return res.status(400).json({ error: 'List ID and item name are required' });
  }

  try {
    // Check permissions
    const [lists] = await db.query(
      'SELECT owner_id FROM shopping_lists WHERE id = ?',
      [shopping_list_id]
    );

    if (lists.length === 0) {
      return res.status(404).json({ error: 'List not found' });
    }

    const isOwner = lists[0].owner_id === userId;
    if (!isOwner) {
      const [shared] = await db.query(
        'SELECT can_edit FROM shared_lists WHERE shopping_list_id = ? AND shared_with_user_id = ?',
        [shopping_list_id, userId]
      );
      if (shared.length === 0 || !shared[0].can_edit) {
        return res.status(403).json({ error: 'No permission to add items' });
      }
    }

    const [result] = await db.query(
      'INSERT INTO list_items (shopping_list_id, name, quantity) VALUES (?, ?, ?)',
      [shopping_list_id, name, quantity || '1']
    );

    const [newItem] = await db.query('SELECT * FROM list_items WHERE id = ?', [result.insertId]);
    res.json(newItem[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to add item' });
  }
});

// Update item (purchased status, name, quantity)
router.put('/:id', authenticateToken, async (req, res) => {
  const itemId = req.params.id;
  const { name, quantity, is_purchased } = req.body;
  const userId = req.user.id;

  try {
    // Get list info
    const [items] = await db.query(`
      SELECT li.*, sl.owner_id 
      FROM list_items li
      JOIN shopping_lists sl ON li.shopping_list_id = sl.id
      WHERE li.id = ?
    `, [itemId]);

    if (items.length === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }

    const item = items[0];
    const isOwner = item.owner_id === userId;
    
    if (!isOwner) {
      const [shared] = await db.query(
        'SELECT can_edit FROM shared_lists WHERE shopping_list_id = ? AND shared_with_user_id = ?',
        [item.shopping_list_id, userId]
      );
      if (shared.length === 0) {
        return res.status(403).json({ error: 'No permission to update items' });
      }
      // Everyone can toggle purchased status, but only editors can change name/quantity
      if ((name !== undefined || quantity !== undefined) && !shared[0].can_edit) {
        return res.status(403).json({ error: 'No permission to edit item details' });
      }
    }

    const updates = [];
    const values = [];
    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name);
    }
    if (quantity !== undefined) {
      updates.push('quantity = ?');
      values.push(quantity);
    }
    if (is_purchased !== undefined) {
      updates.push('is_purchased = ?');
      values.push(is_purchased);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(itemId);
    await db.query(`UPDATE list_items SET ${updates.join(', ')} WHERE id = ?`, values);

    const [updatedItem] = await db.query('SELECT * FROM list_items WHERE id = ?', [itemId]);
    res.json(updatedItem[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update item' });
  }
});

// Delete item
router.delete('/:id', authenticateToken, async (req, res) => {
  const itemId = req.params.id;
  const userId = req.user.id;

  try {
    const [items] = await db.query(`
      SELECT li.*, sl.owner_id 
      FROM list_items li
      JOIN shopping_lists sl ON li.shopping_list_id = sl.id
      WHERE li.id = ?
    `, [itemId]);

    if (items.length === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }

    const item = items[0];
    const isOwner = item.owner_id === userId;
    
    if (!isOwner) {
      const [shared] = await db.query(
        'SELECT can_edit FROM shared_lists WHERE shopping_list_id = ? AND shared_with_user_id = ?',
        [item.shopping_list_id, userId]
      );
      if (shared.length === 0 || !shared[0].can_edit) {
        return res.status(403).json({ error: 'No permission to delete items' });
      }
    }

    await db.query('DELETE FROM list_items WHERE id = ?', [itemId]);
    res.json({ message: 'Item deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to delete item' });
  }
});

module.exports = router;