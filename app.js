const STORAGE_KEY = 'brave-voices-completed-v1';

const headings = new Map([
  ['creative thinking', 'Creative Thinking'],
  ['debating questions for kids', 'Debating Questions for Kids'],
  ['fun communication challenges', 'Communication Challenges'],
  ['alternatives to “how was your day?”', 'Beyond “How Was Your Day?”'],
  ['would you rather questions?', 'Would You Rather?'],
  ['try these with harry potter fans!', 'For Harry Potter Fans'],
  ['get to know you interview questions', 'Get to Know You'],
  ['to build resilience', 'Building Resilience'],
  ['perfect for family dinners', 'Family Dinner Questions'],
  ['debate question', 'Quick Debate Questions'],
  ['home & school life', 'Home & School Life'],
  ['fun & silly picks', 'Fun & Silly Picks'],
  ['school & education', 'School & Education'],
  ['world & ethics', 'World & Ethics'],
  ['education & career', 'Education & Career'],
  ['social & political', 'Social & Political'],
  ['technology & future', 'Technology & Future'],
  ['debate topics for college students', 'College Debate Topics'],
  ['funny issues to debate — lighthearted topics for any occasion', 'Lighthearted Debate Topics'],
  ['funny elementary school debate topics about food', 'Elementary Food Debates'],
  ['more funny issues to debate in elementary classrooms', 'Elementary Classroom Debates'],
  ['funny issues to debate in middle school about food', 'Middle School Food Debates'],
  ['funny debatable pop culture questions for middle school', 'Middle School Pop Culture'],
  ['more silly controversial debate questions for middle school', 'Silly Middle School Debates'],
  ['controversial but funny high school debate topics', 'Funny High School Debates'],
  ['funny pop culture issues to debate in high school', 'High School Pop Culture'],
  ['challenging but silly controversial topics to debate in high school', 'Challenging & Silly Debates'],
  ['food and beverages', 'Food & Beverages'],
  ['family', 'Family'],
  ['education', 'Education'],
  ['entertainment and sports', 'Entertainment & Sports'],
  ['social issues', 'Social Issues'],
  ['money', 'Money'],
  ['miscellaneous', 'More Conversation Starters'],
]);

const sectionIcons = ['💡', '🎙️', '🌈', '🗣️', '✨', '🤝', '🚀', '📚', '🎭', '🌱', '🎨', '🧠'];
const skippedPrefixes = [
  'we have lots more of these',
  'at university level,',
  'these questions suit formal',
  'not every debate needs to save the world',
  'some of the best fun debate topics',
  'these funny issues to debate',
];
const legacyCompletionAliases = new Map([
  ['are zoos ethical', ['q-j54ffb']],
]);

const groupsElement = document.querySelector('#question-groups');
const emptyState = document.querySelector('#empty-state');
const loadError = document.querySelector('#load-error');
const resultCount = document.querySelector('#result-count');
const searchInput = document.querySelector('#search-input');
const categorySelect = document.querySelector('#category-select');
const filterTabs = [...document.querySelectorAll('.filter-tab')];
const progressFill = document.querySelector('#progress-fill');
const progressTrack = document.querySelector('.progress-track');
const progressPercent = document.querySelector('#progress-percent');
const progressMessage = document.querySelector('#progress-message');
const randomDialog = document.querySelector('#random-dialog');
const randomDialogQuestion = document.querySelector('#random-dialog-question');
const randomDialogCategory = document.querySelector('#random-dialog-category');
const randomDialogCheck = document.querySelector('#random-dialog-check');

let questions = [];
let completionFilter = 'all';
let randomSelection = null;
let completed = readCompleted();
let duplicatesRemoved = 0;

function repairText(value) {
  const replacements = new Map([
    ['Â£', '£'], ['â€œ', '“'], ['â€', '”'], ['â€™', '’'], ['â€˜', '‘'],
    ['â€“', '–'], ['â€”', '—'], ['â€¦', '…'], ['â€', ''], ['Â·', '·'],
  ]);
  let output = String(value || '');
  replacements.forEach((replacement, broken) => { output = output.split(broken).join(replacement); });
  return output.replace(/\s+/g, ' ').trim();
}

function normalizeHeading(value) {
  return repairText(value).replace(/^\u200d/, '').toLocaleLowerCase();
}

function stableHash(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function canonicalQuestion(value) {
  return repairText(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function readCompleted() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return new Set(Array.isArray(saved) ? saved : []);
  } catch {
    return new Set();
  }
}

function saveCompleted() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...completed]));
}

function parseQuestions(source) {
  const parsed = [];
  const legacyOccurrences = new Map();
  const byCanonicalText = new Map();
  let category = 'Creative Thinking';
  let pending = null;
  duplicatesRemoved = 0;

  const commit = () => {
    if (!pending) return;
    const text = repairText(pending.text);
    if (text) {
      const legacySignature = `${pending.category}\u0000${text}`;
      const occurrence = legacyOccurrences.get(legacySignature) || 0;
      legacyOccurrences.set(legacySignature, occurrence + 1);
      const legacyId = `q-${stableHash(`${legacySignature}\u0000${occurrence}`)}`;
      const canonical = canonicalQuestion(text);
      const existing = byCanonicalText.get(canonical);

      if (existing) {
        existing.legacyIds.push(legacyId);
        duplicatesRemoved += 1;
      } else if (canonical) {
        const question = {
          id: `question-${stableHash(canonical)}`,
          legacyIds: [legacyId, ...(legacyCompletionAliases.get(canonical) || [])],
          category: pending.category,
          text,
        };
        byCanonicalText.set(canonical, question);
        parsed.push(question);
      }
    }
    pending = null;
  };

  source.split(/\r?\n/).forEach((rawLine) => {
    const line = repairText(rawLine);
    if (!line) {
      commit();
      return;
    }

    const explicitHeading = line.match(/^#{1,6}\s+(.+)$/) || line.match(/^\[([^\]]+)\]$/);
    if (explicitHeading) {
      commit();
      const headingLabel = repairText(explicitHeading[1]);
      category = headings.get(normalizeHeading(headingLabel)) || headingLabel;
      return;
    }

    const headingKey = normalizeHeading(line);
    if (headings.has(headingKey)) {
      commit();
      category = headings.get(headingKey);
      return;
    }

    if (skippedPrefixes.some((prefix) => headingKey.startsWith(prefix))) {
      commit();
      return;
    }

    const numbered = line.match(/^\d+\.\s*(.+)$/);
    if (numbered) {
      commit();
      pending = { category, text: numbered[1] };
      return;
    }

    if (pending) {
      const previousLineIsIncomplete = !/[.!?…“”'\")\]]$/.test(pending.text);
      if (previousLineIsIncomplete) {
        pending.text += ` ${line}`;
        return;
      }

      commit();
    }

    pending = { category, text: line };
    commit();
  });

  commit();
  return parsed;
}

function migrateCompletedQuestions() {
  let changed = false;
  questions.forEach((question) => {
    if (completed.has(question.id)) return;
    if (question.legacyIds.some((legacyId) => completed.has(legacyId))) {
      completed.add(question.id);
      changed = true;
    }
  });
  if (changed) saveCompleted();
}

function populateCategories() {
  const categories = [...new Set(questions.map((question) => question.category))];
  categories.forEach((category) => {
    const option = document.createElement('option');
    option.value = category;
    option.textContent = category;
    categorySelect.appendChild(option);
  });
}

function visibleQuestions() {
  const query = searchInput.value.trim().toLocaleLowerCase();
  const selectedCategory = categorySelect.value;
  return questions.filter((question) => {
    const isDone = completed.has(question.id);
    const matchesStatus = completionFilter === 'all'
      || (completionFilter === 'done' && isDone)
      || (completionFilter === 'open' && !isDone);
    const matchesCategory = selectedCategory === 'all' || question.category === selectedCategory;
    const matchesSearch = !query
      || question.text.toLocaleLowerCase().includes(query)
      || question.category.toLocaleLowerCase().includes(query);
    return matchesStatus && matchesCategory && matchesSearch;
  });
}

function updateProgress() {
  const done = questions.filter((question) => completed.has(question.id)).length;
  const total = questions.length;
  const remaining = Math.max(0, total - done);
  const percent = total ? Math.round((done / total) * 100) : 0;

  document.querySelector('#hero-total').textContent = total.toLocaleString();
  document.querySelector('#hero-done').textContent = done.toLocaleString();
  document.querySelector('#hero-left').textContent = remaining.toLocaleString();
  progressPercent.textContent = `${percent}%`;
  progressFill.style.width = `${percent}%`;
  progressTrack.setAttribute('aria-valuenow', String(percent));

  if (percent === 100) progressMessage.textContent = 'Amazing work—you completed every question!';
  else if (percent >= 75) progressMessage.textContent = 'The finish line is in sight. Keep sharing your voice!';
  else if (percent >= 40) progressMessage.textContent = 'You are building a wonderful speaking habit.';
  else if (done > 0) progressMessage.textContent = 'A brave start! Every answer builds confidence.';
  else progressMessage.textContent = 'Choose a question and give it your best try.';
}

function createQuestionItem(question, index) {
  const item = document.createElement('li');
  item.className = `question-item${completed.has(question.id) ? ' is-done' : ''}`;
  item.id = question.id;

  const number = document.createElement('span');
  number.className = 'question-number';
  number.textContent = String(index + 1).padStart(2, '0');

  const label = document.createElement('label');
  label.className = 'question-text';
  label.htmlFor = `${question.id}-check`;
  label.textContent = question.text;

  const checkbox = document.createElement('input');
  checkbox.className = 'question-check';
  checkbox.id = `${question.id}-check`;
  checkbox.type = 'checkbox';
  checkbox.checked = completed.has(question.id);
  checkbox.setAttribute('aria-label', `Mark as complete: ${question.text}`);
  checkbox.addEventListener('change', () => {
    if (checkbox.checked) completed.add(question.id);
    else {
      completed.delete(question.id);
      question.legacyIds.forEach((legacyId) => completed.delete(legacyId));
    }
    item.classList.toggle('is-done', checkbox.checked);
    saveCompleted();
    updateProgress();
    if (completionFilter !== 'all') renderQuestions();
  });

  item.append(number, label, checkbox);
  return item;
}

function renderQuestions() {
  const visible = visibleQuestions();
  groupsElement.replaceChildren();
  const grouped = new Map();
  visible.forEach((question) => {
    if (!grouped.has(question.category)) grouped.set(question.category, []);
    grouped.get(question.category).push(question);
  });

  let displayedIndex = 0;
  [...grouped.entries()].forEach(([category, categoryQuestions], sectionIndex) => {
    const section = document.createElement('section');
    section.className = 'question-section';

    const heading = document.createElement('div');
    heading.className = 'section-heading';
    const icon = document.createElement('span');
    icon.className = 'section-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = sectionIcons[sectionIndex % sectionIcons.length];
    const headingCopy = document.createElement('div');
    const title = document.createElement('h2');
    title.textContent = category;
    const count = document.createElement('p');
    count.textContent = `${categoryQuestions.length} ${categoryQuestions.length === 1 ? 'question' : 'questions'}`;
    headingCopy.append(title, count);
    heading.append(icon, headingCopy);

    const list = document.createElement('ol');
    list.className = 'question-list';
    categoryQuestions.forEach((question) => {
      list.appendChild(createQuestionItem(question, displayedIndex));
      displayedIndex += 1;
    });

    section.append(heading, list);
    groupsElement.appendChild(section);
  });

  const label = visible.length === questions.length
    ? `${visible.length.toLocaleString()} questions`
    : `${visible.length.toLocaleString()} of ${questions.length.toLocaleString()} questions`;
  resultCount.textContent = label;
  groupsElement.hidden = visible.length === 0;
  emptyState.hidden = visible.length > 0;
}

function chooseRandomQuestion() {
  const pool = visibleQuestions().filter((question) => !completed.has(question.id));
  const fallbackPool = visibleQuestions().length ? visibleQuestions() : questions;
  const choices = pool.length ? pool : fallbackPool;
  if (!choices.length) return;
  randomSelection = choices[Math.floor(Math.random() * choices.length)];
  randomDialogQuestion.textContent = randomSelection.text;
  randomDialogCategory.textContent = randomSelection.category;
  randomDialogCheck.checked = completed.has(randomSelection.id);
  randomDialogCheck.setAttribute('aria-label', `Mark as complete: ${randomSelection.text}`);
  if (!randomDialog.open) randomDialog.showModal();
}

function clearFilters() {
  searchInput.value = '';
  categorySelect.value = 'all';
  completionFilter = 'all';
  filterTabs.forEach((button) => {
    const active = button.dataset.filter === 'all';
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  renderQuestions();
}

searchInput.addEventListener('input', renderQuestions);
categorySelect.addEventListener('change', renderQuestions);
filterTabs.forEach((button) => {
  button.addEventListener('click', () => {
    completionFilter = button.dataset.filter;
    filterTabs.forEach((tab) => {
      const active = tab === button;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-pressed', String(active));
    });
    renderQuestions();
  });
});

document.querySelector('#clear-filters').addEventListener('click', clearFilters);
document.querySelector('#random-question').addEventListener('click', chooseRandomQuestion);
document.querySelector('#another-random-question').addEventListener('click', chooseRandomQuestion);
document.querySelector('#close-dialog').addEventListener('click', () => randomDialog.close());
randomDialogCheck.addEventListener('change', () => {
  if (!randomSelection) return;
  if (randomDialogCheck.checked) completed.add(randomSelection.id);
  else {
    completed.delete(randomSelection.id);
    randomSelection.legacyIds.forEach((legacyId) => completed.delete(legacyId));
  }
  saveCompleted();
  updateProgress();
  renderQuestions();
});
randomDialog.addEventListener('click', (event) => {
  if (event.target === randomDialog) randomDialog.close();
});

document.querySelector('#show-random-question').addEventListener('click', () => {
  if (!randomSelection) return;
  clearFilters();
  randomDialog.close();
  requestAnimationFrame(() => {
    const target = document.getElementById(randomSelection.id);
    target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    target?.classList.add('flash');
    window.setTimeout(() => target?.classList.remove('flash'), 1300);
  });
});

document.querySelector('#clear-progress').addEventListener('click', () => {
  if (!completed.size) return;
  if (!window.confirm('Reset every completed checkbox? This cannot be undone.')) return;
  completed.clear();
  saveCompleted();
  updateProgress();
  renderQuestions();
});

async function initialize() {
  try {
    const response = await fetch('question.txt', { cache: 'no-cache' });
    if (!response.ok) throw new Error(`Question file returned ${response.status}`);
    questions = parseQuestions(await response.text());
    if (!questions.length) throw new Error('No questions were found');
    migrateCompletedQuestions();
    console.info(`Loaded ${questions.length} unique questions; removed ${duplicatesRemoved} duplicates.`);
    populateCategories();
    updateProgress();
    renderQuestions();
    groupsElement.setAttribute('aria-busy', 'false');
    chooseRandomQuestion();
  } catch (error) {
    console.error(error);
    groupsElement.hidden = true;
    loadError.hidden = false;
    resultCount.textContent = 'Questions unavailable';
  }

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

initialize();
