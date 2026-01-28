const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { isAuthenticated, isCashier, isKitchen, isShipper } = require('../middleware/auth');

// Public routes (customer)
router.post('/create', orderController.createOrder);
router.get('/:id', orderController.getOrder);
router.get('/:id/status', orderController.getOrderStatus);
router.post('/:id/claim-payment', orderController.claimPayment);
router.post('/:id/cancel', orderController.cancelOrder);
router.get('/history', orderController.getCustomerHistory);

// Cashier routes
router.get('/', isCashier, orderController.getOrdersByStatus);
router.put('/:id/status', isCashier, orderController.updateOrderStatus);
router.post('/:id/confirm-payment', isCashier, orderController.confirmPayment);

// Kitchen routes
router.get('/kitchen', isKitchen, orderController.getKitchenOrders);

// Shipper routes
router.get('/shipper', isShipper, orderController.getShipperOrders);
router.post('/:id/assign-shipper', isShipper, orderController.assignShipper);
router.post('/:id/complete-delivery', isShipper, orderController.completeDelivery);

module.exports = router;
