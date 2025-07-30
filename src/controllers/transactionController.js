const TransactionModel = require('../models/transactionModel');
const ProductModel = require('../models/productModel');
const CustomerModel = require('../models/customerModel');
const db = require('../config/db');

// 🔁 Helper: Mengelompokkan item transaksi berdasarkan ID transaksi
const groupTransactions = (transactionItems) => {
    if (!transactionItems || transactionItems.length === 0) return [];

    const transactionsMap = new Map();

    transactionItems.forEach(item => {
        if (!transactionsMap.has(item.id)) {
            transactionsMap.set(item.id, {
                id: item.id,
                customer_id: item.customer_id,
                customer_name: item.customer_name,
                total_amount: item.total_amount,
                status: item.status,
                transaction_date: item.transaction_date,
                items: []
            });
        }
        transactionsMap.get(item.id).items.push({
            item_id: item.item_id,
            product_id: item.product_id,
            product_name: item.product_name,
            quantity: item.quantity,
            price_per_item: item.price_per_item
        });
    });

    return Array.from(transactionsMap.values());
};

const TransactionController = {
    /**
     * Membuat transaksi baru
     */
    createTransaction: async (req, res) => {
        const { customerId, items } = req.body;

        if (!customerId || !items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ message: 'Customer ID and transaction items are required' });
        }

        const connection = await db.getConnection();

        try {
            await connection.beginTransaction();

            // 1. Validasi customer
            const [customerRows] = await connection.execute(
                'SELECT * FROM customers WHERE id = ?', [customerId]
            );
            if (customerRows.length === 0) {
                await connection.rollback();
                connection.release();
                return res.status(404).json({ message: 'Customer not found' });
            }

            // 2. Ambil semua produk
            const productIds = items.map(item => item.productId);
            const placeholders = productIds.map(() => '?').join(',');
            const [products] = await connection.execute(
                `SELECT * FROM products WHERE id IN (${placeholders})`, productIds
            );

            if (!products || products.length === 0) {
                await connection.rollback();
                connection.release();
                return res.status(404).json({ message: 'No products found' });
            }

            const productsMap = new Map(products.map(p => [p.id.toString(), p]));
            let totalAmount = 0;
            const processedItems = [];

            // 3. Validasi stok & hitung total
            for (const item of items) {
                const product = productsMap.get(item.productId.toString());
                if (!product) {
                    await connection.rollback();
                    connection.release();
                    return res.status(404).json({ message: `Product with ID ${item.productId} not found` });
                }
                if (product.stock < item.quantity) {
                    await connection.rollback();
                    connection.release();
                    return res.status(400).json({
                        message: `Not enough stock for product ${product.name}. Available: ${product.stock}`
                    });
                }

                totalAmount += product.price * item.quantity;
                processedItems.push({
                    productId: product.id,
                    quantity: item.quantity,
                    pricePerItem: product.price
                });
            }

            // 4. Simpan transaksi utama
            const [transactionResult] = await connection.execute(
                'INSERT INTO transactions (customer_id, total_amount, status) VALUES (?, ?, ?)',
                [customerId, totalAmount, 'pending']
            );

            const transactionId = transactionResult.insertId;

            // 5. Simpan item & update stok
            for (const item of processedItems) {
                await connection.execute(
                    'INSERT INTO transaction_items (transaction_id, product_id, quantity, price_per_item) VALUES (?, ?, ?, ?)',
                    [transactionId, item.productId, item.quantity, item.pricePerItem]
                );

                await connection.execute(
                    'UPDATE products SET stock = stock - ? WHERE id = ?',
                    [item.quantity, item.productId]
                );
            }

            await connection.commit();
            connection.release();

            return res.status(201).json({
                message: 'Transaction created successfully',
                transactionId
            });

        } catch (error) {
            await connection.rollback();
            connection.release();
            console.error('[UNCAUGHT ERROR]', error);
            return res.status(500).json({ message: 'Error creating transaction', error: error.message });
        }
    },

    getTransactionById: async (req, res) => {
        const { id } = req.params;

        try {
            const transactionItems = await TransactionModel.findById(id);
            const grouped = groupTransactions(transactionItems);

            if (grouped.length === 0) {
                return res.status(404).json({ message: 'Transaction not found' });
            }

            res.status(200).json(grouped[0]);

        } catch (error) {
            console.error('Error getting transaction by ID:', error);
            res.status(500).json({ message: 'Error getting transaction' });
        }
    },

    getTransactionsByCustomerId: async (req, res) => {
        const { customerId } = req.params;

        try {
            const transactionItems = await TransactionModel.findByCustomerId(customerId);
            const grouped = groupTransactions(transactionItems);

            if (grouped.length === 0) {
                return res.status(404).json({ message: 'No transactions found for this customer' });
            }

            res.status(200).json(grouped);

        } catch (error) {
            console.error('Error getting transactions by customer ID:', error);
            res.status(500).json({ message: 'Error getting transactions' });
        }
    },

    getAllTransactions: async (req, res) => {
        try {
            const transactionItems = await TransactionModel.getAll();
            const grouped = groupTransactions(transactionItems);
            res.status(200).json(grouped);
        } catch (error) {
            console.error('Error getting all transactions:', error);
            res.status(500).json({ message: 'Error getting all transactions' });
        }
    },

    updateTransactionStatus: async (req, res) => {
        const { id } = req.params;
        const { status } = req.body;

        if (!status || !['pending', 'completed', 'cancelled'].includes(status)) {
            return res.status(400).json({ message: 'Invalid status provided' });
        }

        if (status === 'cancelled') {
            const trx = await db.transaction();

            try {
                const items = await TransactionModel.findItemsByTransactionId(id, trx);
                if (items.length === 0) {
                    await trx.rollback();
                    return res.status(404).json({ message: 'Transaction not found or already processed' });
                }

                await Promise.all(items.map(item =>
                    ProductModel.increaseStock(item.product_id, item.quantity, trx)
                ));

                await TransactionModel.updateStatus(id, status, trx);
                await trx.commit();
                return res.status(200).json({ message: 'Transaction cancelled and stock restored.' });

            } catch (error) {
                await trx.rollback();
                console.error('Error cancelling transaction:', error);
                return res.status(500).json({ message: 'Error cancelling transaction' });
            }
        }

        try {
            const affectedRows = await TransactionModel.updateStatus(id, status);
            if (affectedRows === 0) {
                return res.status(404).json({ message: 'Transaction not found or no changes made' });
            }
            res.status(200).json({ message: 'Transaction status updated successfully' });

        } catch (error) {
            console.error('Error updating transaction status:', error);
            res.status(500).json({ message: 'Error updating transaction status' });
        }
    },

    deleteTransaction: async (req, res) => {
        const { id } = req.params;
        const trx = await db.transaction();

        try {
            const items = await TransactionModel.findItemsByTransactionId(id, trx);

            if (items.length > 0) {
                await Promise.all(items.map(item =>
                    ProductModel.increaseStock(item.product_id, item.quantity, trx)
                ));
            }

            const affectedRows = await TransactionModel.delete(id, trx);
            if (affectedRows === 0) {
                await trx.rollback();
                return res.status(404).json({ message: 'Transaction not found' });
            }

            await trx.commit();
            return res.status(200).json({ message: 'Transaction deleted and stock restored successfully' });

        } catch (error) {
            await trx.rollback();
            console.error('Error deleting transaction:', error);
            res.status(500).json({ message: 'Error deleting transaction' });
        }
    }
};

module.exports = TransactionController;
