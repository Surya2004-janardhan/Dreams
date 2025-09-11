// Data Cleaning Utility Functions
const cleanLLMData = {
  // Remove unwanted characters and format text properly
  cleanText: (text) => {
    if (!text || typeof text !== "string") return "";

    return text
      .replace(/\*\*/g, "") // Remove bold markdown
      .replace(/\*/g, "") // Remove italic markdown
      .replace(/#{1,6}\s/g, "") // Remove heading markdown
      .replace(/^\s*-\s*/gm, "") // Remove bullet points
      .replace(/^\s*\d+\.\s*/gm, "") // Remove numbered lists
      .replace(/\[.*?\]\(.*?\)/g, "") // Remove markdown links
      .replace(/`.*?`/g, "") // Remove inline code
      .replace(/```[\s\S]*?```/g, "") // Remove code blocks
      .replace(/\n{3,}/g, "\n\n") // Reduce multiple newlines
      .replace(/\s+/g, " ") // Normalize whitespace
      .trim();
  },

  // Extract clean conversation from AI response
  extractConversation: (aiResponse) => {
    if (!aiResponse) return "";

    // Remove common AI response patterns
    let cleaned = aiResponse
      .replace(/Here's?\s+(a|an|the)?\s*(conversation|script|dialogue)/i, "")
      .replace(
        /I'll create\s+(a|an|the)?\s*(conversation|script|dialogue)/i,
        ""
      )
      .replace(
        /Let me (create|write|generate)\s+(a|an|the)?\s*(conversation|script|dialogue)/i,
        ""
      )
      .replace(/^(Assistant:|AI:|Bot:)/gm, "")
      .replace(/^\*\*Note:.*$/gm, "") // Remove note lines
      .replace(/^\*\*Disclaimer:.*$/gm, ""); // Remove disclaimer lines

    return cleanLLMData.cleanText(cleaned);
  },

  // Validate conversation format
  hasValidSpeakers: (text) => {
    const speakerPattern = /^(Speaker\s*[AB12]|Person\s*[AB12]|Host|Guest):/gm;
    const matches = text.match(speakerPattern);
    return matches && matches.length >= 2;
  },

  // Format conversation with consistent speaker labels
  formatConversation: (text) => {
    let formatted = text
      .replace(/^(Person\s*A|Speaker\s*1):/gm, "Speaker A:")
      .replace(/^(Person\s*B|Speaker\s*2):/gm, "Speaker B:")
      .replace(/^Host:/gm, "Speaker A:")
      .replace(/^Guest:/gm, "Speaker B:");

    return formatted;
  },
};

module.exports = cleanLLMData;
