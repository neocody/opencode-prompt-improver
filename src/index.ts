/**
 * OpenCode Prompt Improver Plugin
 * Automatically evaluates prompts for clarity and triggers research-based
 * clarification when prompts are vague or ambiguous.
 * Based on: https://github.com/severity1/claude-code-prompt-improver
 */

import type { Plugin } from '@opencode-ai/plugin';
import { tool } from '@opencode-ai/plugin';

interface EvaluationResult {
  isVague: boolean;
  score: number;
  reasons: string[];
  suggestions: string[];
}

interface PromptAnalysis {
  hasTarget: boolean;
  hasAction: boolean;
  hasCriteria: boolean;
  hasContext: boolean;
}

const BYPASS_PREFIXES = ['*', '/', '#', '!'];

const TARGET_PATTERNS = [
  /\b(in|at|from)\s+["`']?[\w/.]+\.[a-z]+["`']?/i,
  /\b(function|class|method|component|file|module)\s+["`']?\w+["`']?/i,
  /\b(line|lines?)\s+\d+/i,
  /["`'][\w/.]+\.[a-z]+["`']/i,
  /\b(src|lib|app|components?|pages?|api|utils?|hooks?|services?)\//i,
];

const ACTION_PATTERNS = [
  /\b(refactor|convert|change|update|modify)\s+.+\s+(to|from|into|using)/i,
  /\b(add|create|implement|write)\s+.+\s+(to|in|for|that)/i,
  /\b(fix|resolve|debug)\s+.+\s+(error|bug|issue|problem|in)/i,
  /\b(remove|delete|drop)\s+.+\s+(from|in)/i,
  /\b(rename|move)\s+.+\s+(to|from)/i,
  /\b(test|validate|check)\s+.+\s+(for|that|if)/i,
];

const VAGUE_INDICATORS = [
  /^(fix|improve|update|change|refactor|add|help)\s+(it|this|that|the code|the bug|the issue)$/i,
  /^(make|do)\s+(it|this|that)\s+(better|work|faster)$/i,
  /^(can you|please|just)\s+(fix|help|do)/i,
  /\b(somehow|something|somewhere|anything)\b/i,
  /^(fix|improve|update|change)\s+(this|it|that)$/i,
];

const CLEAR_SINGLE_ACTIONS = [
  /^(commit|push|pull|merge|rebase|stash)/i,
  /^(build|test|lint|format|deploy)/i,
  /^(install|uninstall|upgrade|update)\s+\w+/i,
];

function shouldBypass(prompt: string): boolean {
  const trimmed = prompt.trim();

  for (const prefix of BYPASS_PREFIXES) {
    if (trimmed.startsWith(prefix)) {
      return true;
    }
  }

  return trimmed.length < 5;
}

function analyzePrompt(prompt: string): PromptAnalysis {
  for (const pattern of CLEAR_SINGLE_ACTIONS) {
    if (pattern.test(prompt)) {
      return { hasTarget: true, hasAction: true, hasCriteria: true, hasContext: true };
    }
  }

  let hasTarget = false;
  for (const pattern of TARGET_PATTERNS) {
    if (pattern.test(prompt)) {
      hasTarget = true;
      break;
    }
  }

  let hasAction = false;
  for (const pattern of ACTION_PATTERNS) {
    if (pattern.test(prompt)) {
      hasAction = true;
      break;
    }
  }

  const hasCriteria =
    hasTarget &&
    hasAction &&
    (prompt.includes('should') ||
      prompt.includes('must') ||
      prompt.includes('to use') ||
      prompt.includes('instead of') ||
      prompt.includes('using'));

  const hasContext = hasTarget && hasAction;

  return { hasTarget, hasAction, hasCriteria, hasContext };
}

function evaluatePrompt(prompt: string): EvaluationResult {
  const reasons: string[] = [];
  const suggestions: string[] = [];
  let score = 100;

  for (const pattern of VAGUE_INDICATORS) {
    if (pattern.test(prompt)) {
      score -= 40;
      reasons.push('Prompt uses vague language without specifics');
      suggestions.push('Specify which file, function, or component to modify');
      break;
    }
  }

  const analysis = analyzePrompt(prompt);

  if (!analysis.hasTarget) {
    score -= 25;
    reasons.push('No specific target (file, function, component) identified');
    suggestions.push('Mention the specific file or function to work on');
  }

  if (!analysis.hasAction) {
    score -= 25;
    reasons.push('Action is not clearly defined');
    suggestions.push('Be specific about what change to make (e.g., "refactor X to use Y")');
  }

  if (!analysis.hasCriteria) {
    score -= 15;
    reasons.push('No clear success criteria');
    suggestions.push('Describe the expected outcome or behavior');
  }

  if (!analysis.hasContext) {
    score -= 15;
    reasons.push('Insufficient context for execution');
    suggestions.push('Provide relevant context or constraints');
  }

  if (prompt.trim().split(/\s+/).length < 4) {
    score -= 20;
    reasons.push('Prompt is very short and may lack necessary details');
  }

  score = Math.max(0, Math.min(100, score));

  return {
    isVague: score < 60,
    score,
    reasons: [...new Set(reasons)],
    suggestions: [...new Set(suggestions)],
  };
}

function generateImprovementPrompt(originalPrompt: string, evaluation: EvaluationResult): string {
  return `
<prompt-improvement-context>
The user's prompt has been evaluated and determined to need clarification before execution.

**Original Prompt:** "${originalPrompt}"

**Evaluation Score:** ${evaluation.score}/100

**Issues Identified:**
${evaluation.reasons.map((r) => `- ${r}`).join('\n')}

**Suggestions:**
${evaluation.suggestions.map((s) => `- ${s}`).join('\n')}

**Your Task:**
Before executing this request, you MUST:

1. **Research Phase** (use TodoWrite to plan):
   - Check conversation history for relevant context
   - Explore the codebase to understand the current state
   - Search for existing patterns, similar implementations
   - Identify specific files, functions, or components involved

2. **Generate Clarifying Questions**:
   Based on your research, ask 1-4 targeted questions using specific options found in the codebase.
   Each option should reference actual files, functions, or patterns you discovered.
   
   Format your questions clearly with numbered options, for example:
   "Which component should be modified?
   1. LoginForm (src/components/LoginForm.tsx) - handles user authentication
   2. AuthService (src/services/auth.ts) - manages auth state
   3. Other - please specify"

3. **Wait for User Response**:
   Do not proceed with implementation until the user has answered your questions.

4. **Execute with Context**:
   Once you have answers, proceed with the task using:
   - The original intent
   - User's clarifications
   - Your research findings

**Important:**
- Do NOT guess or assume - research first
- Ground all options in actual codebase findings
- Keep questions focused and minimal (1-4 questions max)
- If conversation history provides sufficient context, you may ask fewer questions
</prompt-improvement-context>

Now, begin the research phase for: "${originalPrompt}"
`;
}

export const PromptImproverPlugin: Plugin = async () => {
  const evaluatePromptTool = tool({
    description:
      'Evaluate a prompt for clarity and determine if it needs improvement. Returns evaluation score and suggestions.',
    args: {
      prompt: tool.schema.string().describe('The prompt text to evaluate'),
    },
    async execute(args: { prompt: string }) {
      const evaluation = evaluatePrompt(args.prompt);
      return JSON.stringify(evaluation, null, 2);
    },
  });

  const improvePromptTool = tool({
    description:
      'Generate an improved prompt with research and clarification instructions for a vague prompt.',
    args: {
      prompt: tool.schema.string().describe('The vague prompt to improve'),
    },
    async execute(args: { prompt: string }) {
      const evaluation = evaluatePrompt(args.prompt);
      if (!evaluation.isVague) {
        return JSON.stringify({
          status: 'clear',
          message: 'Prompt is clear enough to proceed without clarification',
          score: evaluation.score,
        });
      }
      return generateImprovementPrompt(args.prompt, evaluation);
    },
  });

  return {
    tool: {
      evaluate_prompt: evaluatePromptTool,
      improve_prompt: improvePromptTool,
    },

    'chat.message': async (_hookInput, output) => {
      const textParts = output.parts.filter((p) => p.type === 'text');
      if (textParts.length === 0) return;

      type TextPart = { type: 'text'; text: string };
      const prompt = textParts.map((p) => (p as TextPart).text).join('\n');

      if (shouldBypass(prompt)) return;

      const evaluation = evaluatePrompt(prompt);

      if (evaluation.isVague) {
        const lastTextPart = textParts[textParts.length - 1] as TextPart & { text: string };
        lastTextPart.text = `${lastTextPart.text}\n\n${generateImprovementPrompt(prompt, evaluation)}`;
      }
    },
  };
};

export default PromptImproverPlugin;
