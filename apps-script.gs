function doGet(e) {
  const params = e && e.parameter ? e.parameter : {};
  const action = params.action || "";
  
  if (action === "getpoll") {
    return getPoll();
  } else if (action === "getsummary") {
    return getSummary();
  } else if (action === "getresponses") {
    return getResponses();
  } else if (action === "submitvote") {
    return submitVote(params);
  } else if (action === "test") {
    return ContentService.createTextOutput(JSON.stringify({ok: true, message: "API working"}))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  return ContentService.createTextOutput(JSON.stringify({ok: false, error: "Unknown action"}))
    .setMimeType(ContentService.MimeType.JSON);
}

function getPoll() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("Questions");
    if (!sheet) {
      return ContentService.createTextOutput(JSON.stringify({ok: false, error: "Questions sheet not found. Run setup() first."}))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    const data = sheet.getDataRange().getValues();
    
    if (data.length < 2) {
      return ContentService.createTextOutput(JSON.stringify({ok: false, error: "No poll data found. Please add data to the Questions sheet."}))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    const memberNames = [];
    const categories = {};
    
    // Get members from first column (skip header)
    for (let i = 1; i < data.length; i++) {
      const name = data[i][0];
      if (name && name.toString().trim() !== "") {
        memberNames.push(name.toString().trim());
      }
    }
    
    // Get categories and options from other columns
    for (let col = 1; col < data[0].length; col++) {
      const category = data[0][col];
      if (!category || category.toString().trim() === "") continue;
      
      const options = [];
      for (let row = 1; row < data.length; row++) {
        const value = data[row][col];
        if (value && value.toString().trim() !== "") {
          let opt = value.toString().trim();
          // Format date if it's a date column
          if (category.toString().toLowerCase() === "date") {
            opt = formatDate(opt);
          }
          if (!options.includes(opt)) {
            options.push(opt);
          }
        }
      }
      categories[category.toString()] = options;
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      ok: true,
      memberNames: memberNames,
      categories: categories,
      totalMembers: memberNames.length
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch(e) {
    return ContentService.createTextOutput(JSON.stringify({ok: false, error: e.toString()}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function submitVote(params) {
  try {
    const memberName = params.memberName;
    if (!memberName) {
      return ContentService.createTextOutput(JSON.stringify({ok: false, error: "No name provided"}))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // Get votes - EXCLUDE action, memberName, and ANY parameter starting with _ (timestamp)
    const votes = {};
    for (let key in params) {
      // Skip internal parameters (action, memberName, and anything starting with _)
      if (key !== "action" && key !== "memberName" && !key.startsWith("_")) {
        votes[key] = params[key];
      }
    }
    
    // Check if any votes were collected
    if (Object.keys(votes).length === 0) {
      return ContentService.createTextOutput(JSON.stringify({ok: false, error: "No votes provided"}))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // Save to sheet
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("Responses");
    if (!sheet) {
      return ContentService.createTextOutput(JSON.stringify({ok: false, error: "Responses sheet not found. Run setup() first."}))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // Check if already voted
    const existing = sheet.getDataRange().getValues();
    for (let i = 1; i < existing.length; i++) {
      if (existing[i][1] === memberName && existing[i][4] === "active") {
        return ContentService.createTextOutput(JSON.stringify({ok: false, error: "Already voted"}))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    // Save vote
    const voteId = Utilities.getUuid();
    const votedAt = new Date().toISOString();
    
    sheet.appendRow([
      voteId,
      memberName,
      JSON.stringify(votes),
      votedAt,
      "active"
    ]);
    
    return ContentService.createTextOutput(JSON.stringify({
      ok: true, 
      message: "Vote recorded", 
      votes: votes,
      voteId: voteId
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch(e) {
    return ContentService.createTextOutput(JSON.stringify({ok: false, error: e.toString()}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function getSummary() {
  try {
    // Get poll structure first
    const pollResponse = getPoll();
    const pollContent = JSON.parse(pollResponse.getContent());
    if (!pollContent.ok) {
      return pollResponse;
    }
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("Responses");
    if (!sheet) {
      return ContentService.createTextOutput(JSON.stringify({ok: false, error: "Responses sheet not found"}))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    const data = sheet.getDataRange().getValues();
    const votes = {};
    const voters = [];
    
    // Count votes
    for (let i = 1; i < data.length; i++) {
      if (data[i][4] === "active") {
        voters.push(data[i][1]);
        let userVotes = {};
        try {
          userVotes = JSON.parse(data[i][2]);
        } catch(e) {
          userVotes = {};
        }
        for (let cat in userVotes) {
          // Skip any category that starts with _ (timestamp)
          if (!cat.startsWith("_")) {
            if (!votes[cat]) votes[cat] = {};
            if (!votes[cat][userVotes[cat]]) votes[cat][userVotes[cat]] = 0;
            votes[cat][userVotes[cat]]++;
          }
        }
      }
    }
    
    // Calculate percentages
    const totalVoters = voters.length;
    const summary = {};
    for (let cat in votes) {
      summary[cat] = {};
      for (let opt in votes[cat]) {
        summary[cat][opt] = {
          count: votes[cat][opt],
          percentage: totalVoters > 0 ? Math.round((votes[cat][opt] / totalVoters) * 100) : 0
        };
      }
    }
    
    const pendingCount = pollContent.memberNames.filter(n => !voters.includes(n)).length;
    
    return ContentService.createTextOutput(JSON.stringify({
      ok: true,
      summary: summary,
      totalVoters: totalVoters,
      totalMembers: pollContent.totalMembers,
      pendingCount: pendingCount,
      lastUpdated: new Date().toLocaleString()
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch(e) {
    return ContentService.createTextOutput(JSON.stringify({ok: false, error: e.toString()}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function getResponses() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("Responses");
    if (!sheet) {
      return ContentService.createTextOutput(JSON.stringify({ok: false, error: "Responses sheet not found"}))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    const data = sheet.getDataRange().getValues();
    const responses = [];
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][4] === "active") {
        let votes = {};
        try {
          votes = JSON.parse(data[i][2]);
        } catch(e) {
          votes = {};
        }
        // Clean votes - remove any timestamp fields
        const cleanVotes = {};
        for (let key in votes) {
          if (!key.startsWith("_")) {
            cleanVotes[key] = votes[key];
          }
        }
        responses.push({
          memberName: data[i][1],
          votes: cleanVotes,
          votedAt: data[i][3]
        });
      }
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      ok: true,
      responses: responses,
      total: responses.length
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch(e) {
    return ContentService.createTextOutput(JSON.stringify({ok: false, error: e.toString()}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function formatDate(value) {
  if (!value) return "";
  if (value instanceof Date) {
    return value.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  const d = new Date(value);
  if (!isNaN(d.getTime())) {
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  return value.toString();
}

function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Create Questions sheet
  let qSheet = ss.getSheetByName("Questions");
  if (!qSheet) {
    qSheet = ss.insertSheet("Questions");
    qSheet.appendRow(["Name", "Venue", "Date"]);
    qSheet.appendRow(["Johnny Li", "JW Hotel", "2026-05-30"]);
    qSheet.appendRow(["Carmen Tam", "Angus Café", "2026-06-06"]);
    qSheet.appendRow(["Jason Wu", "Success Chinese Restaurant", "2026-06-13"]);
    qSheet.appendRow(["Bill Chan", "Wins Japanese Restaurant", "2026-06-20"]);
    qSheet.appendRow(["Michelle Wong", "Grand Hyatt", "2026-06-27"]);
    qSheet.appendRow(["Kevin Leung", "The Peninsula", "2026-07-04"]);
  }
  
  // Create Responses sheet
  let rSheet = ss.getSheetByName("Responses");
  if (!rSheet) {
    rSheet = ss.insertSheet("Responses");
    rSheet.appendRow(["VoteId", "MemberName", "Votes", "VotedAt", "Status"]);
  }
  
  return ContentService.createTextOutput("Setup complete. Questions and Responses sheets created.");
}

function addSampleQuestions() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Questions");
  if (!sheet) {
    return ContentService.createTextOutput("Questions sheet not found. Run setup() first.");
  }
  
  const sampleData = [
    ["Johnny Li", "JW Hotel", "2026-05-30"],
    ["Carmen Tam", "Angus Café", "2026-06-06"],
    ["Jason Wu", "Success Chinese Restaurant", "2026-06-13"],
    ["Bill Chan", "Wins Japanese Restaurant", "2026-06-20"],
    ["Michelle Wong", "Grand Hyatt", "2026-06-27"],
    ["Kevin Leung", "The Peninsula", "2026-07-04"],
    ["Sarah Chan", "Marco Polo", "2026-07-11"],
    ["David Wong", "Harbour Plaza", "2026-07-18"]
  ];
  
  for (let i = 0; i < sampleData.length; i++) {
    sheet.appendRow(sampleData[i]);
  }
  
  return ContentService.createTextOutput("Added " + sampleData.length + " sample questions.");
}

function clearAllResponses() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Responses");
  if (!sheet) {
    return ContentService.createTextOutput("Responses sheet not found.");
  }
  
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.deleteRows(2, lastRow - 1);
    return ContentService.createTextOutput("Cleared " + (lastRow - 1) + " responses.");
  }
  return ContentService.createTextOutput("No responses to clear.");
}

function debugSheetStructure() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  const qSheet = ss.getSheetByName("Questions");
  const rSheet = ss.getSheetByName("Responses");
  
  let output = "=== SHEET STRUCTURE ===\n\n";
  
  if (qSheet) {
    output += "QUESTIONS SHEET:\n";
    output += "  Location: " + qSheet.getParent().getUrl() + "\n";
    output += "  Last Row: " + qSheet.getLastRow() + "\n";
    output += "  Last Column: " + qSheet.getLastColumn() + "\n";
    const data = qSheet.getDataRange().getValues();
    output += "  Headers: " + JSON.stringify(data[0]) + "\n";
    output += "  Total rows with data: " + data.length + "\n";
  } else {
    output += "QUESTIONS SHEET: NOT FOUND\n";
  }
  
  output += "\n";
  
  if (rSheet) {
    output += "RESPONSES SHEET:\n";
    output += "  Location: " + rSheet.getParent().getUrl() + "\n";
    output += "  Last Row: " + rSheet.getLastRow() + "\n";
    output += "  Last Column: " + rSheet.getLastColumn() + "\n";
    const data = rSheet.getDataRange().getValues();
    output += "  Headers: " + JSON.stringify(data[0]) + "\n";
    output += "  Total responses: " + (data.length - 1) + "\n";
  } else {
    output += "RESPONSES SHEET: NOT FOUND\n";
  }
  
  return ContentService.createTextOutput(output);
}

function testAPI() {
  const poll = getPoll();
  const summary = getSummary();
  
  let output = "=== API TEST ===\n\n";
  output += "GET POLL:\n" + poll.getContent() + "\n\n";
  output += "GET SUMMARY:\n" + summary.getContent() + "\n";
  
  return ContentService.createTextOutput(output);
}
