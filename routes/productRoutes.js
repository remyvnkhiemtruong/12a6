const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { isAdmin, isKitchen } = require('../middleware/auth');

// Public routes (customer)
router.get('/menu', productController.getMenu);
router.get('/best-sellers', productController.getBestSellers);
router.get('/random', productController.getRandomProduct);
router.get('/categories', productController.getCategories);
router.get('/:id', productController.getProduct);

// Kitchen routes
router.put('/:id/availability', isKitchen, productController.toggleAvailability);

// Admin routes
router.post('/', isAdmin, productController.createProduct);
router.put('/:id', isAdmin, productController.updateProduct);
router.delete('/:id', isAdmin, productController.deleteProduct);
router.put('/:id/stock', isAdmin, productController.updateStock);

// Category management
router.post('/categories', isAdmin, productController.createCategory);
router.put('/categories/:id', isAdmin, productController.updateCategory);

module.exports = router;
