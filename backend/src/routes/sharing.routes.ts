import { Router } from 'express';
import { authenticate, optionalAuth } from '../middleware/auth.middleware';
import * as sharingController from '../controllers/sharing.controller';

const router = Router();

router.post('/documents/:id/invite', authenticate, sharingController.invite);
router.delete('/documents/:id/access/:userId', authenticate, sharingController.revoke);
router.post('/documents/:id/share', authenticate, sharingController.createLink);
router.get('/documents/:id/shared/:token', optionalAuth, sharingController.getShared);
router.get('/documents/:id/access', authenticate, sharingController.getAccessList);

export const sharingRouter = router;
