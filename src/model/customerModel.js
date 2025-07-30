const pool = require('../config/db');

const CustomerModel = {
  /**
   * Creates a new customer record in the database.
   * @param {string} userId - The ID of the associated user.
   * @param {string} name - The name of the customer.
   * @param {string} email - The email of the customer.
   * @param {string} [phone] - The phone number of the customer (optional).
   * @param {string} [address] - The address of the customer (optional).
   * @returns {Promise<number>} The ID of the newly created customer.
   */
  create: async (userId, name, email, phone, address) => {
    const [result] = await pool.execute(
      'INSERT INTO customers (user_id, name, email, phone, address) VALUES (?, ?, ?, ?, ?)',
      [userId, name, email, phone, address]
    );
    return result.insertId;
  },

  /**
   * Finds a customer by their unique ID.
   * @param {string} id - The unique ID of the customer.
   * @returns {Promise<object|undefined>} The customer object if found, otherwise undefined.
   */
  findById: async (id) => {
    const [rows] = await pool.execute(
      'SELECT * FROM customers WHERE id = ?',
      [id]
    );
    return rows[0];
  },

  /**
   * Finds a customer by their associated user ID.
   * @param {string} userId - The ID of the user associated with the customer.
   * @returns {Promise<object|undefined>} The customer object if found, otherwise undefined.
   */
  findByUserId: async (userId) => {
    const [rows] = await pool.execute(
      'SELECT * FROM customers WHERE user_id = ?',
      [userId]
    );
    return rows[0];
  },

  /**
   * Updates an existing customer's information.
   * @param {string} id - The ID of the customer to update.
   * @param {string} name - The new name of the customer.
   * @param {string} email - The new email of the customer.
   * @param {string} [phone] - The new phone number of the customer (optional).
   * @param {string} [address] - The new address of the customer (optional).
   * @returns {Promise<number>} The number of affected rows (0 if customer not found, 1 if updated).
   */
  update: async (id, name, email, phone, address) => {
    const [result] = await pool.execute(
      'UPDATE customers SET name = ?, email = ?, phone = ?, address = ? WHERE id = ?',
      [name, email, phone, address, id]
    );
    return result.affectedRows;
  },

  /**
   * Deletes a customer record from the database.
   * @param {string} id - The ID of the customer to delete.
   * @returns {Promise<number>} The number of affected rows (0 if customer not found, 1 if deleted).
   */
  delete: async (id) => {
    const [result] = await pool.execute(
      'DELETE FROM customers WHERE id = ?',
      [id]
    );
    return result.affectedRows;
  },

  /**
   * Retrieves all customer records from the database.
   * @returns {Promise<Array<object>>} An array of customer objects.
   */
  getAll: async () => {
    const [rows] = await pool.execute('SELECT * FROM customers');
    return rows;
  }
};

module.exports = CustomerModel;