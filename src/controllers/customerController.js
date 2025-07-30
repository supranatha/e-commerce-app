const CustomerModel = require('../models/customerModel');

const CustomerController = {
  /**
   * Creates a new customer.
   * @param {object} req - The request object.
   * @param {object} res - The response object.
   */
  createCustomer: async (req, res) => {
    const { userId, name, email, phone, address } = req.body;

    // Validate required fields
    if (!userId || !name || !email) {
      return res.status(400).json({ message: 'User ID, name, and email are required.' });
    }

    try {
      const customerId = await CustomerModel.create(userId, name, email, phone, address);
      res.status(201).json({ message: 'Customer created successfully.', customerId });
    } catch (error) {
      console.error('Error creating customer:', error);
      res.status(500).json({ message: 'Failed to create customer.' });
    }
  },

  /**
   * Retrieves a customer by their unique ID.
   * @param {object} req - The request object.
   * @param {object} res - The response object.
   */
  getCustomerById: async (req, res) => {
    const { id } = req.params;

    try {
      const customer = await CustomerModel.findById(id);
      if (!customer) {
        return res.status(404).json({ message: 'Customer not found.' });
      }
      res.status(200).json(customer);
    } catch (error) {
      console.error('Error fetching customer by ID:', error);
      res.status(500).json({ message: 'Failed to retrieve customer.' });
    }
  },

  /**
   * Retrieves a customer by their associated user ID.
   * @param {object} req - The request object.
   * @param {object} res - The response object.
   */
  getCustomerByUserId: async (req, res) => {
    const { userId } = req.params;

    try {
      const customer = await CustomerModel.findByUserId(userId);
      if (!customer) {
        return res.status(404).json({ message: 'Customer not found for this user ID.' });
      }
      res.status(200).json(customer);
    } catch (error) {
      console.error('Error fetching customer by user ID:', error);
      res.status(500).json({ message: 'Failed to retrieve customer by user ID.' });
    }
  },

  /**
   * Updates an existing customer's details.
   * @param {object} req - The request object.
   * @param {object} res - The response object.
   */
  updateCustomer: async (req, res) => {
    const { id } = req.params;
    const { name, email, phone, address } = req.body;

    try {
      const affectedRows = await CustomerModel.update(id, name, email, phone, address);
      if (affectedRows === 0) {
        // If no rows were affected, it means the customer wasn't found or no changes were submitted
        return res.status(404).json({ message: 'Customer not found or no changes were made.' });
      }
      res.status(200).json({ message: 'Customer updated successfully.' });
    } catch (error) {
      console.error('Error updating customer:', error);
      res.status(500).json({ message: 'Failed to update customer.' });
    }
  },

  /**
   * Deletes a customer by their unique ID.
   * @param {object} req - The request object.
   * @param {object} res - The response object.
   */
  deleteCustomer: async (req, res) => {
    const { id } = req.params;

    try {
      const affectedRows = await CustomerModel.delete(id);
      if (affectedRows === 0) {
        return res.status(404).json({ message: 'Customer not found.' });
      }
      res.status(200).json({ message: 'Customer deleted successfully.' });
    } catch (error) {
      console.error('Error deleting customer:', error);
      res.status(500).json({ message: 'Failed to delete customer.' });
    }
  },

  /**
   * Retrieves all customers.
   * @param {object} req - The request object.
   * @param {object} res - The response object.
   */
  getAllCustomers: async (req, res) => {
    try {
      const customers = await CustomerModel.getAll();
      res.status(200).json(customers);
    } catch (error) {
      console.error('Error fetching all customers:', error);
      res.status(500).json({ message: 'Failed to retrieve all customers.' });
    }
  }
};

module.exports = CustomerController;