const express = require("express");
const {
  runWorkflow,
  runAutomatedWorkflow,
  getWorkflowStatus,
} = require("../controllers/workflowController");

const router = express.Router();

// POST /workflow/auto - Automated workflow (pulls from Google Sheets)
router.post("/auto", runAutomatedWorkflow);

// POST /workflow/run - Manual workflow execution (legacy)
router.post("/run", runWorkflow);

// GET /workflow/status - Get current workflow status
router.get("/status", getWorkflowStatus);

module.exports = router;
