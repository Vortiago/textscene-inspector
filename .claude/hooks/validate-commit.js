#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');

try {
  let input = '';
  process.stdin.on('data', chunk => input += chunk);
  process.stdin.on('end', () => {
    const data = JSON.parse(input);
    const command = data.tool_input?.command || '';
    const isRemote = process.env.CLAUDE_CODE_REMOTE === 'true';
    
    // Only validate git commits in Claude Code Web
    if (isRemote && command.includes('git') && command.includes('commit') && !command.includes('--no-verify')) {
      console.error('🔍 Running validation before commit (Claude Code Web)...');
      
      try {
        const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
        execSync('pnpm validate', { 
          cwd: projectDir,
          stdio: 'inherit'
        });
        console.error('✅ Validation passed!');
        process.exit(0);
      } catch (error) {
        console.error('❌ Validation failed. Commit blocked.');
        console.error("Run 'pnpm validate' to see specific errors.");
        process.exit(2);
      }
    }
    
    process.exit(0);
  });
} catch (error) {
  console.error('Hook execution error:', error.message);
  process.exit(1);
}
