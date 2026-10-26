export type ShareCardTheme = "forest" | "acid" | "obsidian";

export interface ShareCardData {
  title: string;
  desiredOutcome: string;
  totalTasks: number;
  completedTasks: number;
  totalEffortMin?: number | null;
  tasks?: Array<{ title: string; status: string }>;
  hideTaskTitles?: boolean;
}

export interface ShareCardThemeConfig {
  name: string;
  background: string;
  surface: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  accent: string;
  accentText: string;
  pillBg: string;
  pillText: string;
}

export const THEMES: Record<ShareCardTheme, ShareCardThemeConfig> = {
  forest: {
    name: "Deep Forest",
    background: "#081D14",
    surface: "#0F2E21",
    border: "#1C4734",
    textPrimary: "#FBF8F0",
    textSecondary: "#A5C5B5",
    accent: "#C8F169",
    accentText: "#081D14",
    pillBg: "#143C2B",
    pillText: "#C8F169",
  },
  acid: {
    name: "Minimal Acid",
    background: "#FBF8F0",
    surface: "#FFFFFF",
    border: "#E2DCC8",
    textPrimary: "#0D1813",
    textSecondary: "#5F6B64",
    accent: "#224A2F",
    accentText: "#FFFFFF",
    pillBg: "#EBF8D3",
    pillText: "#184524",
  },
  obsidian: {
    name: "Midnight Obsidian",
    background: "#0D0E12",
    surface: "#181A22",
    border: "#292C3A",
    textPrimary: "#F2F3F7",
    textSecondary: "#8A8F9F",
    accent: "#6EE7B7",
    accentText: "#0D0E12",
    pillBg: "#212431",
    pillText: "#6EE7B7",
  },
};

/**
 * Wraps text into lines that do not exceed maxWidth on a 2D canvas context.
 */
export function wrapCanvasText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

/**
 * Draws a rounded rectangle path on the canvas context.
 */
function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

/**
 * Renders the share card onto an HTML5 Canvas (1200 x 630).
 */
export function renderShareCardToCanvas(
  canvas: HTMLCanvasElement,
  data: ShareCardData,
  themeKey: ShareCardTheme = "forest",
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const width = 1200;
  const height = 630;
  canvas.width = width;
  canvas.height = height;

  const theme = THEMES[themeKey] || THEMES.forest;

  // 1. Background
  ctx.fillStyle = theme.background;
  ctx.fillRect(0, 0, width, height);

  // Subtle decorative border inset
  ctx.strokeStyle = theme.border;
  ctx.lineWidth = 2;
  drawRoundedRect(ctx, 30, 30, width - 60, height - 60, 20);
  ctx.stroke();

  // 2. Header: Logo / Brand & Tagline
  ctx.fillStyle = theme.accent;
  ctx.beginPath();
  ctx.arc(75, 75, 8, 0, Math.PI * 2);
  ctx.fill();

  ctx.font = "bold 20px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.fillStyle = theme.textPrimary;
  ctx.fillText("CLEARSTEP", 95, 82);

  ctx.font = "normal 16px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.fillStyle = theme.textSecondary;
  ctx.fillText("ANTI-ANXIETY ACTION PLAN", 250, 82);

  // Status Badge in Top Right
  const isFinished = data.totalTasks > 0 && data.completedTasks === data.totalTasks;
  const badgeText = isFinished
    ? "✓ PLAN COMPLETED"
    : `${data.completedTasks} OF ${data.totalTasks} STEPS DONE`;

  ctx.font = "bold 15px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  const badgeWidth = ctx.measureText(badgeText).width + 32;
  const badgeHeight = 36;
  const badgeX = width - 75 - badgeWidth;
  const badgeY = 60;

  ctx.fillStyle = isFinished ? theme.accent : theme.pillBg;
  drawRoundedRect(ctx, badgeX, badgeY, badgeWidth, badgeHeight, 18);
  ctx.fill();

  ctx.fillStyle = isFinished ? theme.accentText : theme.pillText;
  ctx.fillText(badgeText, badgeX + 16, badgeY + 23);

  // 3. Central Outcome Card (Surface)
  const cardX = 65;
  const cardY = 125;
  const cardW = width - 130;
  const cardH = 390;

  ctx.fillStyle = theme.surface;
  drawRoundedRect(ctx, cardX, cardY, cardW, cardH, 16);
  ctx.fill();

  ctx.strokeStyle = theme.border;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // 4. Headline / Outcome
  const displayTitle = data.desiredOutcome || data.title || "Clear my head and take action";
  ctx.font = "bold 36px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.fillStyle = theme.textPrimary;
  const titleLines = wrapCanvasText(ctx, displayTitle, cardW - 70);

  let currentY = cardY + 55;
  for (let i = 0; i < Math.min(titleLines.length, 2); i++) {
    ctx.fillText(titleLines[i], cardX + 35, currentY);
    currentY += 44;
  }

  // 5. Metric Pill Row
  currentY += 10;
  const percent = data.totalTasks > 0 ? Math.round((data.completedTasks / data.totalTasks) * 100) : 0;

  // Stat chips
  const chips = [
    `Progress: ${percent}%`,
    `${data.completedTasks} completed`,
    `${data.totalTasks - data.completedTasks} remaining`,
  ];
  if (data.totalEffortMin) {
    chips.push(`~${Math.round(data.totalEffortMin)}m estimated effort`);
  }

  let chipX = cardX + 35;
  ctx.font = "500 15px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  for (const chip of chips) {
    const chipW = ctx.measureText(chip).width + 24;
    ctx.fillStyle = theme.pillBg;
    drawRoundedRect(ctx, chipX, currentY, chipW, 30, 8);
    ctx.fill();

    ctx.fillStyle = theme.pillText;
    ctx.fillText(chip, chipX + 12, currentY + 20);
    chipX += chipW + 12;
  }

  // 6. Highlight Steps Preview OR Privacy Mode
  currentY += 56;
  ctx.strokeStyle = theme.border;
  ctx.beginPath();
  ctx.moveTo(cardX + 35, currentY);
  ctx.lineTo(cardX + cardW - 35, currentY);
  ctx.stroke();

  currentY += 30;

  if (data.hideTaskTitles || !data.tasks || data.tasks.length === 0) {
    // Privacy Mode / Shield
    ctx.font = "italic 18px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.fillStyle = theme.textSecondary;
    ctx.fillText(
      "🔒 Private focus plan • Individual task details kept personal & confidential",
      cardX + 35,
      currentY + 20,
    );
  } else {
    // Render up to 3 highlight steps
    const sampleTasks = data.tasks.slice(0, 3);
    for (const step of sampleTasks) {
      const isDone = step.status === "done";
      ctx.fillStyle = isDone ? theme.accent : theme.textSecondary;
      ctx.font = "bold 16px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      ctx.fillText(isDone ? "✓" : "○", cardX + 35, currentY);

      ctx.font = "16px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      ctx.fillStyle = isDone ? theme.textSecondary : theme.textPrimary;

      // Truncate step title if too long
      let stepTitle = step.title;
      if (ctx.measureText(stepTitle).width > cardW - 120) {
        while (ctx.measureText(`${stepTitle}...`).width > cardW - 120 && stepTitle.length > 5) {
          stepTitle = stepTitle.slice(0, -1);
        }
        stepTitle = `${stepTitle}...`;
      }

      ctx.fillText(stepTitle, cardX + 65, currentY);
      currentY += 32;
    }

    if (data.tasks.length > 3) {
      ctx.font = "14px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      ctx.fillStyle = theme.textSecondary;
      ctx.fillText(`+ ${data.tasks.length - 3} more steps in full plan`, cardX + 65, currentY);
    }
  }

  // 7. Footer
  ctx.font = "normal 15px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.fillStyle = theme.textSecondary;
  ctx.fillText("Turn mental overwhelm into calm, actionable steps • clearstep.app", 75, height - 52);

  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const dateWidth = ctx.measureText(dateStr).width;
  ctx.fillText(dateStr, width - 75 - dateWidth, height - 52);
}

/**
 * Converts a rendered HTML5 canvas into a PNG Blob.
 */
export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error("Canvas toBlob failed"));
      }
    }, "image/png");
  });
}

/**
 * Copies canvas image to the user's system clipboard using ClipboardItem.
 */
export async function copyCanvasImageToClipboard(canvas: HTMLCanvasElement): Promise<boolean> {
  try {
    const blob = await canvasToBlob(canvas);
    if (!navigator.clipboard || typeof ClipboardItem === "undefined") {
      return false;
    }
    await navigator.clipboard.write([
      new ClipboardItem({
        "image/png": blob,
      }),
    ]);
    return true;
  } catch {
    return false;
  }
}

/**
 * Triggers a file download for the canvas image.
 */
export function downloadCanvasImage(canvas: HTMLCanvasElement, filename = "clearstep-momentum.png") {
  const dataUrl = canvas.toDataURL("image/png");
  const anchor = document.createElement("a");
  anchor.href = dataUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
}

/**
 * Generates an aesthetic plain-text summary suitable for pasting to Twitter, Discord, or notes.
 */
export function buildShareText(data: ShareCardData): string {
  const percent = data.totalTasks > 0 ? Math.round((data.completedTasks / data.totalTasks) * 100) : 0;
  const status =
    data.totalTasks > 0 && data.completedTasks === data.totalTasks
      ? "🎯 100% Completed!"
      : `⏳ ${data.completedTasks}/${data.totalTasks} steps completed (${percent}%)`;

  let text = `🧠 Brain Dump → Action Plan with Clearstep\nOutcome: "${data.desiredOutcome || data.title}"\nStatus: ${status}\n`;

  if (!data.hideTaskTitles && data.tasks && data.tasks.length > 0) {
    text += "\nSteps:\n";
    for (const task of data.tasks.slice(0, 5)) {
      const mark = task.status === "done" ? "✅" : "⬜";
      text += `${mark} ${task.title}\n`;
    }
    if (data.tasks.length > 5) {
      text += `...and ${data.tasks.length - 5} more steps.\n`;
    }
  }

  text += "\nCreated with https://clearstep.app";
  return text;
}
