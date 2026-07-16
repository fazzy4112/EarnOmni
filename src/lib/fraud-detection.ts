/**
 * EarnOmni Fraud Detection System
 * Automated verification with 0-100 risk scoring
 * 
 * Score Breakdown:
 * 90-100  = ✅ AUTO-APPROVE (Safe user)
 * 70-89   = ⏳ MANUAL REVIEW (Slight concerns)
 * 50-69   = ⚠️ MANUAL REVIEW (Suspicious activity)
 * 30-49   = ❌ LIKELY FRAUD (Bot/Fake patterns)
 * 0-29    = 🚫 AUTO-REJECT (Definite fraud)
 */

import { supabase } from "@/integrations/supabase/client";

export interface DeviceFingerprint {
  ipAddress: string;
  userAgent: string;
  deviceId: string;
  browser: string;
  os: string;
  country: string;
  isVPN: boolean;
}

export interface FraudCheckResult {
  fraudScore: number; // 0-100
  riskLevel: "safe" | "low" | "medium" | "high" | "critical";
  decision: "auto_approve" | "manual_review" | "auto_reject";
  details: {
    deviceCheck: number;
    timeCheck: number;
    behavioralCheck: number;
    ipCheck: number;
    duplicateCheck: number;
    flaggedReasons: string[];
  };
  verificationDetails: any;
}

// ============================================
// 1. DEVICE FINGERPRINTING
// ============================================

export async function captureDeviceFingerprint(): Promise<DeviceFingerprint> {
  // Get IP Address (using IP geolocation API)
  const ipResponse = await fetch("https://api.ipify.org?format=json").catch(
    () => null
  );
  const ipData = ipResponse ? await ipResponse.json() : { ip: "unknown" };

  // Parse User Agent
  const userAgent = navigator.userAgent;
  const browser = parseBrowser(userAgent);
  const os = parseOS(userAgent);
  const deviceId = getOrCreateDeviceId();

  // Get country (simplified - in production use IP geolocation API)
  const country = "PK"; // Default for now

  return {
    ipAddress: ipData.ip,
    userAgent,
    deviceId,
    browser,
    os,
    country,
    isVPN: false, // Would need VPN detection service
  };
}

function parseBrowser(userAgent: string): string {
  if (userAgent.includes("Chrome")) return "Chrome";
  if (userAgent.includes("Firefox")) return "Firefox";
  if (userAgent.includes("Safari")) return "Safari";
  if (userAgent.includes("Edge")) return "Edge";
  return "Unknown";
}

function parseOS(userAgent: string): string {
  if (userAgent.includes("Windows")) return "Windows";
  if (userAgent.includes("Mac")) return "MacOS";
  if (userAgent.includes("Linux")) return "Linux";
  if (userAgent.includes("Android")) return "Android";
  if (userAgent.includes("iPhone") || userAgent.includes("iPad"))
    return "iOS";
  return "Unknown";
}

function getOrCreateDeviceId(): string {
  let deviceId = localStorage.getItem("adlearn_device_id");
  if (!deviceId) {
    deviceId = generateUUID();
    localStorage.setItem("adlearn_device_id", deviceId);
  }
  return deviceId;
}

function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ============================================
// 2. BEHAVIORAL ANALYSIS
// ============================================

export interface BehavioralData {
  timeSpent: number; // milliseconds
  clickCount: number;
  scrollDepth: number; // 0-100%
  deviceChanges: number;
  taskCompletionCount: number;
  avgTaskCompletionTime: number;
  tasksInLastHour: number;
}

export async function calculateBehavioralScore(
  userId: string,
  taskId: string,
  timeSpent: number
): Promise<number> {
  let score = 50; // Start at neutral

  // 1. Check completion time
  if (timeSpent < 5000) {
    score -= 25; // Too fast (< 5 seconds)
  } else if (timeSpent > 300000) {
    score -= 10; // Too slow (> 5 min = suspicious)
  } else if (timeSpent > 10000 && timeSpent < 120000) {
    score += 15; // Normal time range (10s - 2min)
  }

  // 2. Check for rapid submissions
  const { data: recentTasks } = await supabase
    .from("task_completions")
    .select("created_at")
    .eq("user_id", userId)
    .gt("created_at", new Date(Date.now() - 3600000).toISOString())
    .order("created_at", { ascending: false })
    .limit(10);

  if ((recentTasks?.length ?? 0) > 8) {
    score -= 20; // Suspicious rapid completion pattern
  } else if ((recentTasks?.length ?? 0) > 0) {
    score -= 5; // Slight concern for multiple tasks
  }

  // 3. Check task history
  const { data: taskHistory } = await supabase
    .from("user_task_history")
    .select("completed_count")
    .eq("user_id", userId)
    .eq("task_id", taskId)
    .single();

  if (taskHistory && taskHistory.completed_count > 1) {
    score -= 30; // User already completed this task
  } else if (!taskHistory) {
    score += 10; // First time with this task = good sign
  }

  return Math.max(0, Math.min(100, score));
}

// ============================================
// 3. DEVICE CHECK
// ============================================

export async function calculateDeviceScore(
  userId: string,
  fingerprint: DeviceFingerprint
): Promise<number> {
  let score = 50; // Start neutral

  // 1. Check for VPN
  if (fingerprint.isVPN) {
    score -= 20;
  }

  // 2. Check if new device
  const { data: existingDevices } = await supabase
    .from("device_fingerprints")
    .select("id")
    .eq("user_id", userId)
    .eq("device_id", fingerprint.deviceId);

  if (!existingDevices || existingDevices.length === 0) {
    score -= 10; // New device (slight concern)
  } else {
    score += 10; // Known device
  }

  // 3. Check for multiple users from same IP
  const { data: sameIpUsers } = await supabase
    .from("device_fingerprints")
    .select("user_id")
    .eq("ip_address", fingerprint.ipAddress)
    .neq("user_id", userId);

  if ((sameIpUsers?.length ?? 0) > 3) {
    score -= 25; // Multiple accounts from same IP
  } else if ((sameIpUsers?.length ?? 0) > 0) {
    score -= 10; // Few accounts from same IP
  }

  // 4. High-risk country check
  if (["NG", "GH", "ZA"].includes(fingerprint.country)) {
    score -= 15; // Known fraud hotspots
  }

  return Math.max(0, Math.min(100, score));
}

// ============================================
// 4. DUPLICATE CHECK
// ============================================

export async function calculateDuplicateScore(
  userId: string,
  taskId: string
): Promise<number> {
  const { data: existing } = await supabase
    .from("task_completions")
    .select("id, status")
    .eq("user_id", userId)
    .eq("task_id", taskId);

  if (!existing || existing.length === 0) {
    return 50; // No duplicates - neutral
  }

  const approvedCount = existing.filter((x) => x.status === "approved").length;
  if (approvedCount > 0) {
    return 0; // Already completed and approved = fraud
  }

  if (existing.some((x) => x.status === "pending")) {
    return 20; // Duplicate submission = high risk
  }

  return 50; // Rejected before = neutral
}

// ============================================
// 5. IP REPUTATION CHECK
// ============================================

export async function calculateIPScore(ipAddress: string): Promise<number> {
  let score = 50;

  // Simple check: known VPN/proxy ranges
  const vpnRanges = ["45.142.", "185.220.", "104.21."]; // Example ranges
  if (vpnRanges.some((range) => ipAddress.startsWith(range))) {
    score -= 20;
  }

  // In production: Use IP reputation API
  // const response = await fetch(`https://api.abuseipdb.com/api/v2/check`, {
  //   headers: { Key: "YOUR_API_KEY" }
  // });

  return Math.max(0, Math.min(100, score));
}

// ============================================
// 6. MAIN FRAUD DETECTION ENGINE
// ============================================

export async function performFraudCheck(
  userId: string,
  taskId: string,
  timeSpent: number
): Promise<FraudCheckResult> {
  const fingerprint = await captureDeviceFingerprint();

  // Calculate individual scores (0-50 each, will be weighted)
  const deviceScore = await calculateDeviceScore(userId, fingerprint);
  const behavioralScore = await calculateBehavioralScore(userId, taskId, timeSpent);
  const duplicateScore = await calculateDuplicateScore(userId, taskId);
  const ipScore = await calculateIPScore(fingerprint.ipAddress);

  // Weighted average to get final fraud score (0-100)
  const fraudScore = Math.round(
    deviceScore * 0.25 + // 25% device reputation
      behavioralScore * 0.35 + // 35% user behavior
      duplicateScore * 0.25 + // 25% duplicate check
      ipScore * 0.15 // 15% IP reputation
  );

  // Determine risk level and decision
  let riskLevel: "safe" | "low" | "medium" | "high" | "critical";
  let decision: "auto_approve" | "manual_review" | "auto_reject";

  if (fraudScore >= 90) {
    riskLevel = "safe";
    decision = "auto_approve";
  } else if (fraudScore >= 70) {
    riskLevel = "low";
    decision = "manual_review";
  } else if (fraudScore >= 50) {
    riskLevel = "medium";
    decision = "manual_review";
  } else if (fraudScore >= 30) {
    riskLevel = "high";
    decision = "auto_reject";
  } else {
    riskLevel = "critical";
    decision = "auto_reject";
  }

  // Collect flagged reasons
  const flaggedReasons: string[] = [];
  if (timeSpent < 5000) flaggedReasons.push("Task completed too quickly");
  if (duplicateScore < 30) flaggedReasons.push("Duplicate submission detected");
  if (deviceScore < 40) flaggedReasons.push("Suspicious device");
  if (ipScore < 40) flaggedReasons.push("High-risk IP address");

  return {
    fraudScore,
    riskLevel,
    decision,
    details: {
      deviceCheck: deviceScore,
      timeCheck: Math.round(behavioralScore / 2), // Simplified
      behavioralCheck: behavioralScore,
      ipCheck: ipScore,
      duplicateCheck: duplicateScore,
      flaggedReasons,
    },
    verificationDetails: {
      fingerprint,
      timeSpent,
      timestamp: new Date().toISOString(),
    },
  };
}

// ============================================
// 7. SAVE VERIFICATION LOG
// ============================================

export async function saveVerificationLog(
  taskCompletionId: string,
  fraudCheckResult: FraudCheckResult,
  taskType: string
): Promise<void> {
  const { error } = await supabase
    .from("task_verification_logs")
    .insert({
      task_completion_id: taskCompletionId,
      task_type: taskType,
      fraud_score: fraudCheckResult.fraudScore,
      device_check: fraudCheckResult.details.deviceCheck > 50,
      time_check: fraudCheckResult.details.timeCheck > 50,
      behavioral_check: fraudCheckResult.details.behavioralCheck > 50,
      ip_check: fraudCheckResult.details.ipCheck > 50,
      duplicate_check: fraudCheckResult.details.duplicateCheck > 50,
      verification_details: fraudCheckResult.verificationDetails,
      flagged_reason:
        fraudCheckResult.details.flaggedReasons.join("; ") || null,
      auto_approved: fraudCheckResult.decision === "auto_approve",
      requires_manual_review: fraudCheckResult.decision === "manual_review",
    });

  if (error) {
    console.error("Failed to save verification log:", error);
  }
}

// ============================================
// 9. UTILITY FUNCTIONS
// ============================================

export function getScoreColor(score: number): string {
  if (score >= 90) return "text-emerald-400"; // Safe
  if (score >= 70) return "text-yellow-400"; // Low risk
  if (score >= 50) return "text-orange-400"; // Medium risk
  if (score >= 30) return "text-red-400"; // High risk
  return "text-red-600"; // Critical
}

export function getScoreLabel(score: number): string {
  if (score >= 90) return "✅ Safe - Auto Approved";
  if (score >= 70) return "⏳ Low Risk - Manual Review";
  if (score >= 50) return "⚠️ Medium Risk - Manual Review";
  if (score >= 30) return "❌ High Risk - Auto Rejected";
  return "🚫 Critical - Auto Rejected";
}