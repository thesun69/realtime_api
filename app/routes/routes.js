const express = require('express');
const controller = require('../controllers/controller');
// const verifyToken = require('../middleware/verifyToken');
const router = express.Router();

router.post('/auth/login', controller.login);
//==================
router.get('/auth/generate-qr', controller.generateQRCode);
router.post('/auth/initiate-auth', controller.initiateTwoStepAuth);
router.post('/auth/finalize-auth', controller.finalizeAuthentication);
//==================
router.post('/auth/logout', controller.logout);
// router.get('/:tablename', verifyToken, controller.getAll);
router.get('/:tablename', controller.getAll)
router.get('/:tablename/:id', controller.getById);
router.post('/:tablename', controller.create);
router.patch('/:tablename/:id', controller.update);
router.delete('/:tablename/:id', controller.delete);

module.exports = router;
