/**
 * Validators for each step type.
 * Each validator receives (userAnswer, stepConfig) and returns { valid, message }.
 */

function normalize(str) {
  return str
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

const validators = {
  /**
   * single_answer: one correct answer (string comparison, accent-insensitive)
   * config.answers: string[]  (any one is accepted)
   * userAnswer: string
   */
  single_answer(userAnswer, step) {
    const input = normalize(userAnswer);
    const accepted = step.answers.map(a => normalize(a));
    const valid = accepted.includes(input);
    return {
      valid,
      message: valid ? 'Bonne réponse !' : 'Mauvaise réponse, réessayez.'
    };
  },

  /**
   * multiple_answers: multiple fields, all must be correct (order doesn't matter)
   * config.answers: string[]  (all required)
   * userAnswer: string[]  (array of strings)
   */
  multiple_answers(userAnswer, step) {
    if (!Array.isArray(userAnswer)) {
      return { valid: false, message: 'Format de réponse invalide.' };
    }
    const expected = step.answers.map(a => normalize(a)).sort();
    const given = userAnswer.map(a => normalize(a)).sort();

    if (given.length !== expected.length) {
      return { valid: false, message: `Il faut ${expected.length} réponse(s).` };
    }

    const valid = expected.every((exp, i) => given[i] === exp);
    return {
      valid,
      message: valid ? 'Toutes les réponses sont correctes !' : 'Certaines réponses sont incorrectes.'
    };
  },

  /**
   * matching: match items from left column to right column
   * config.pairs: [{ left: string, right: string }]
   * userAnswer: { [left]: right }  (object mapping left to right)
   */
  matching(userAnswer, step) {
    if (typeof userAnswer !== 'object' || Array.isArray(userAnswer)) {
      return { valid: false, message: 'Format de réponse invalide.' };
    }
    const pairs = step.pairs;
    let correct = 0;
    for (const pair of pairs) {
      const userVal = normalize(userAnswer[pair.left] || '');
      const expected = normalize(pair.right);
      if (userVal === expected) correct++;
    }
    const valid = correct === pairs.length;
    return {
      valid,
      message: valid
        ? 'Toutes les associations sont correctes !'
        : `${correct}/${pairs.length} associations correctes.`
    };
  },

  /**
   * cipher: enter a numeric/alphanumeric code
   * config.answers: string[]  (the code(s))
   * userAnswer: string
   */
  cipher(userAnswer, step) {
    const input = normalize(userAnswer);
    const accepted = step.answers.map(a => normalize(a));
    const valid = accepted.includes(input);
    return {
      valid,
      message: valid ? 'Code correct !' : 'Code incorrect, réessayez.'
    };
  },

  /**
   * order: put items in the correct order
   * config.correctOrder: string[]  (items in correct order)
   * userAnswer: string[]  (items in user's order)
   */
  order(userAnswer, step) {
    if (!Array.isArray(userAnswer)) {
      return { valid: false, message: 'Format de réponse invalide.' };
    }
    const expected = step.correctOrder.map(a => normalize(a));
    const given = userAnswer.map(a => normalize(a));

    if (given.length !== expected.length) {
      return { valid: false, message: 'Nombre d\'éléments incorrect.' };
    }

    const valid = expected.every((exp, i) => given[i] === exp);
    return {
      valid,
      message: valid ? 'Ordre correct !' : 'L\'ordre n\'est pas bon, réessayez.'
    };
  },

  /**
   * qcm: multiple choice question
   * config.answers: string[]  (correct answers)
   * config.choices: string[] (all choices)
   * userAnswer: string | string[]
   */
  qcm(userAnswer, step) {
    const expected = step.answers.map(a => normalize(a)).sort();
    const given = (Array.isArray(userAnswer) ? userAnswer : [userAnswer])
      .map(a => normalize(a)).sort();

    const valid = expected.length === given.length &&
      expected.every((exp, i) => given[i] === exp);
    return {
      valid,
      message: valid ? 'Bonne réponse !' : 'Mauvaise réponse, réessayez.'
    };
  },

  /**
   * puzzle: solve a riddle/puzzle with a text answer
   * Same as single_answer but with different UI presentation
   */
  puzzle(userAnswer, step) {
    return validators.single_answer(userAnswer, step);
  },

  /**
   * multi_questions: multiple sub-questions each with their own answer
   * config.questions: [{ description, hint, answers: string[] }]
   * userAnswer: string[]  (one answer per sub-question, in order)
   */
  multi_questions(userAnswer, step) {
    if (!Array.isArray(userAnswer)) {
      return { valid: false, message: 'Format de réponse invalide.' };
    }
    const questions = step.questions;
    if (userAnswer.length !== questions.length) {
      return { valid: false, message: `Il faut ${questions.length} réponse(s).` };
    }

    const results = questions.map((q, i) => {
      const input = normalize(userAnswer[i]);
      const accepted = q.answers.map(a => normalize(a));
      return accepted.includes(input);
    });

    const correctCount = results.filter(Boolean).length;
    const valid = correctCount === questions.length;

    return {
      valid,
      message: valid
        ? 'Toutes les réponses sont correctes !'
        : `${correctCount}/${questions.length} réponses correctes.`
    };
  },

  /**
   * photo_upload: team uploads a photo
   * Validation is handled by the upload route, not here
   */
  photo_upload(userAnswer, step) {
    return { valid: true, message: 'Photo validée !' };
  }
};

function validateAnswer(userAnswer, step) {
  const validator = validators[step.type];
  if (!validator) {
    return { valid: false, message: `Type d'étape inconnu: ${step.type}` };
  }
  return validator(userAnswer, step);
}

module.exports = { validateAnswer };
