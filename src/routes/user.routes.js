import { Router } from 'express';
import { getProfile, updateProfile, deleteAccount } from '../controllers/user.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { updateProfileValidator } from '../validators/user.validator.js';

const router = Router();

// Every route in this file requires a valid access token.
router.use(requireAuth);

router.get('/profile', getProfile);
router.patch('/profile', updateProfileValidator, validate, updateProfile);
router.delete('/account', deleteAccount);

export default router;
