const express = require("express");
const {
  runWorkflow,
  getWorkflowStatus,
} = require("../controllers/workflowController");

const router = express.Router();

// POST /workflow/run - Main workflow execution
router.post("/run", runWorkflow);

// GET /workflow/status - Get current workflow status
router.get("/status", getWorkflowStatus);

module.exports = router;
