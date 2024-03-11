const express = require('express');
const controller = require('../controllers/controller');
// const verifyToken = require('../middleware/verifyToken');
const router = express.Router();

router.post('/login', controller.login);
//==================
router.get('/generate-qr', controller.generateQRCode);
router.post('/verify-qr-session', controller.verifyQRCodeSession);
router.post('/initiate-auth', controller.initiateTwoStepAuth);
router.post('/finalize-auth', controller.finalizeAuthentication);
//==================
router.post('/logout', controller.logout);
// router.get('/:tablename', verifyToken, controller.getAll);
router.get('/:tablename', controller.getAll)
router.get('/:tablename/:id', controller.getById);
router.post('/:tablename', controller.create);
router.patch('/:tablename/:id', controller.update);
router.delete('/:tablename/:id', controller.delete);

module.exports = router;
