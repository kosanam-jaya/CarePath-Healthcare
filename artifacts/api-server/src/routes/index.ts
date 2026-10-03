import { Router, type IRouter } from "express";
import healthRouter from "./health";
import carePathAdminRouter from "./carepath-admin";
import carePathPatientRouter from "./carepath-patient";
import carePathPublicRouter from "./carepath-public";

const router: IRouter = Router();

router.use(healthRouter);
router.use(carePathPublicRouter);
router.use(carePathPatientRouter);
router.use("/admin", carePathAdminRouter);

export default router;
