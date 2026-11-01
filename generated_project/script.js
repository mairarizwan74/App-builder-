// script.js – Simple calculator logic
// ------------------------------------------------------------
// This script selects the display element (#display) and all calculator
// buttons (.calc-btn). It wires click listeners for mouse interaction and
// keyboard listeners for key‑press interaction. The core of the calculator
// is the evaluateExpression() function which safely parses and computes the
// arithmetic expression, handling division‑by‑zero and malformed input.
// ------------------------------------------------------------

(() => {
  // ----- DOM ELEMENTS ------------------------------------------------
  const display = document.getElementById('display');
  const buttons = document.querySelectorAll('.calc-btn');

  // The current expression shown on the display (as a string).
  let expression = '';

  // ----- DISPLAY HELPERS ---------------------------------------------
  const updateDisplay = () => {
    // Support both <input> and generic elements (e.g., <div>).
    if (display) {
      if ('value' in display) display.value = expression;
      else display.textContent = expression;
    }
  };

  // ----- INPUT VALIDATION --------------------------------------------
  const isOperator = (ch) => /[+\-*/]/.test(ch);

  // Determines whether a decimal point can be added to the current number.
  const canAddDecimal = () => {
    // Grab the part of the expression after the last operator.
    const lastNumber = expression.split(/[*+\-\/]/).pop();
    return !lastNumber.includes('.');
  };

  // ----- CORE CALCULATION --------------------------------------------
  const evaluateExpression = () => {
    // Empty expression – nothing to evaluate.
    if (!expression) return;
    try {
      // Use Function constructor for a safe eval‑like behaviour.
      // The expression is wrapped in parentheses to allow leading '+' or '-'.
      const result = Function('"use strict";return (' + expression + ')')();

      // Detect division by zero or other non‑finite results.
      if (!isFinite(result)) {
        throw new Error('Division by zero');
      }

      // Normalise result – avoid trailing .0 for integers.
      expression = Number.isInteger(result) ? result.toString() : result.toFixed(10).replace(/\.?(0)+$/,'');
    } catch (e) {
      // Any parsing or runtime error results in a user‑friendly message.
      expression = 'Error';
    } finally {
      updateDisplay();
    }
  };

  // ----- BUTTON CLICK HANDLER ----------------------------------------
  const handleButtonClick = (btn) => {
    const value = btn.dataset.value !== undefined ? btn.dataset.value : btn.textContent.trim();

    switch (value) {
      case 'C': // Clear
        expression = '';
        updateDisplay();
        break;
      case '=': // Evaluate
        evaluateExpression();
        break;
      case '.': // Decimal point
        if (canAddDecimal()) {
          expression += '.';
          updateDisplay();
        }
        break;
      case '+':
      case '-':
      case '*':
      case '/':
        // Prevent two operators in a row.
        if (expression && !isOperator(expression.slice(-1))) {
          expression += value;
          updateDisplay();
        }
        break;
      default: // Numbers (0‑9)
        if (/^[0-9]$/.test(value)) {
          expression += value;
          updateDisplay();
        }
        break;
    }
  };

  // Attach click listeners to all calculator buttons.
  buttons.forEach((btn) => {
    btn.addEventListener('click', () => handleButtonClick(btn));
  });

  // ----- KEYBOARD LISTENER -------------------------------------------
  const keyMap = {
    'Enter': '=',
    '=': '=',
    'Escape': 'C',
    'c': 'C',
    'C': 'C',
    '+': '+',
    '-': '-',
    '*': '*',
    '/': '/',
    '.': '.',
    '0': '0',
    '1': '1',
    '2': '2',
    '3': '3',
    '4': '4',
    '5': '5',
    '6': '6',
    '7': '7',
    '8': '8',
    '9': '9'
  };

  document.addEventListener('keydown', (e) => {
    const mapped = keyMap[e.key];
    if (!mapped) return; // Unrelated key.
    e.preventDefault(); // Stop default scrolling etc.

    // Find a button that represents the same value (if any) and trigger its click.
    const targetBtn = Array.from(buttons).find((b) => {
      const val = b.dataset.value !== undefined ? b.dataset.value : b.textContent.trim();
      return val === mapped;
    });

    if (targetBtn) {
      targetBtn.click();
    } else {
      // If no button matches (e.g., the display is not a button), fall back to logic.
      // This mirrors the click handling without needing a DOM element.
      const fakeBtn = { textContent: mapped, dataset: {} };
      handleButtonClick(fakeBtn);
    }
  });

  // Initialise display.
  updateDisplay();
})();
