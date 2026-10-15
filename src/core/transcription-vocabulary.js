// Speech biasing hints for Gemini Transcribe, never transcript replacement rules.
const skills = require('./skills');
const LEGACY_VOCABULARY = ['KVCache', 'KV cache', 'key-value cache'];
const SKILL_VOCABULARIES = {
  dsa: [
    'BFS', 'DFS', 'binary search', 'two pointers', 'sliding window', 'prefix sum',
    'dynamic programming', 'memoization', 'backtracking', 'greedy algorithm',
    'divide and conquer', 'hash map', 'hash set', 'linked list', 'binary tree',
    'binary search tree', 'trie', 'heap', 'priority queue', 'monotonic stack',
    'deque', 'union-find', 'disjoint set union', 'DSU', 'segment tree', 'Fenwick tree',
    'topological sort', 'Dijkstra', 'Bellman-Ford', 'Floyd-Warshall', 'Kruskal',
    'KMP', 'LCS', 'LIS', 'Big O', 'amortized complexity',
    'мемоизация', 'асимптотика', 'инвариант', 'разреженная таблица'
  ],
  devops: [
    'Kubernetes', 'kubectl', 'kubelet', 'etcd', 'Helm', 'Docker', 'containerd',
    'Terraform', 'Ansible', 'Argo CD', 'GitOps', 'CI/CD', 'GitLab CI', 'GitHub Actions',
    'Jenkins', 'Prometheus', 'Grafana', 'OpenTelemetry', 'ELK', 'Nginx', 'Ingress',
    'CoreDNS', 'DNS', 'TLS', 'TCP', 'UDP', 'gRPC', 'VPC', 'IAM', 'RBAC',
    'SRE', 'SLI', 'SLO', 'SLA', 'error budget', 'HPA', 'cgroups', 'systemd',
    'blue-green deployment', 'canary deployment', 'роллбэк', 'оркестрация'
  ],
  analyst: [
    'SQL', 'PostgreSQL', 'ClickHouse', 'BigQuery', 'Power BI', 'Tableau', 'ETL',
    'OLAP', 'OLTP', 'CTE', 'JOIN', 'HAVING', 'ROW_NUMBER', 'PARTITION BY',
    'A/B test', 'p-value', 'MDE', 'statistical power', 'confidence interval',
    'ARPU', 'ARPPU', 'LTV', 'CAC', 'DAU', 'WAU', 'MAU', 'CTR', 'retention',
    'churn rate', 'conversion rate', 'unit economics', 'BPMN', 'UML', 'ERD',
    'user story', 'use case', 'когортный анализ', 'воронка', 'доверительный интервал',
    'статистическая значимость', 'критерии приёмки'
  ],
  backend: [
    'REST', 'GraphQL', 'gRPC', 'WebSocket', 'OpenAPI', 'HTTP', 'TLS', 'JWT',
    'OAuth', 'OIDC', 'RBAC', 'SQL', 'PostgreSQL', 'MySQL', 'MongoDB', 'Redis',
    'Kafka', 'RabbitMQ', 'ACID', 'BASE', 'CAP theorem', 'MVCC', 'WAL', 'B-tree',
    'LSM tree', 'CQRS', 'event sourcing', 'transactional outbox', 'saga',
    'idempotency', 'backpressure', 'circuit breaker', 'rate limiting', 'deadlock',
    'race condition', 'sharding', 'replication', 'connection pool',
    'идемпотентность', 'шардирование', 'уровень изоляции', 'репликация'
  ],
  'ml-engineer': [
    'PyTorch', 'TensorFlow', 'scikit-learn', 'XGBoost', 'LightGBM', 'CatBoost',
    'NumPy', 'pandas', 'CUDA', 'cuDNN', 'ONNX', 'TensorRT', 'Triton', 'MLflow',
    'DVC', 'Airflow', 'Kubeflow', 'feature store', 'cross-validation', 'data leakage',
    'data drift', 'concept drift', 'training-serving skew', 'ROC AUC', 'PR AUC',
    'F1 score', 'precision', 'recall', 'RMSE', 'MAE', 'log loss', 'AdamW',
    'gradient boosting', 'regularization', 'batch normalization', 'dropout',
    'learning rate', 'backpropagation', 'эмбеддинг', 'переобучение', 'квантизация'
  ],
  'ai-engineer': [
    'KVCache', 'KV cache', 'key-value cache', 'LLM', 'RAG', 'GraphRAG',
    'embeddings', 'vector database', 'chunking', 'reranking', 'BM25', 'HNSW',
    'FAISS', 'Qdrant', 'pgvector', 'Pinecone', 'Chroma', 'LangChain', 'LlamaIndex',
    'MCP', 'function calling', 'tool calling', 'structured outputs', 'JSON Schema',
    'prompt injection', 'grounding', 'hallucination', 'context window', 'tokenization',
    'LoRA', 'QLoRA', 'PEFT', 'RLHF', 'DPO', 'vLLM', 'FlashAttention', 'TTFT',
    'TPOT', 'Gemini', 'OpenAI', 'Claude', 'Llama', 'эмбеддинг', 'квантизация'
  ]
};

const DEFAULT_VOCABULARY = SKILL_VOCABULARIES.dsa;

function vocabularyEnvKey(skill) {
  if (!skills.some(item => item.id === skill)) throw new Error('Unsupported vocabulary skill');
  return 'GEMINI_TRANSCRIBE_VOCABULARY_' + skill.toUpperCase().replace(/-/g, '_');
}

// Preserve a former custom global glossary on its original profile at the first
// profile edit/switch. The old built-in KVCache-only default needs no migration.
function legacyVocabularyUpdates(env, skill = skills.some(item => item.id === env.ACTIVE_SKILL) ? env.ACTIVE_SKILL : 'dsa') {
  if (env.GEMINI_TRANSCRIBE_VOCABULARY === undefined ||
      skills.some(item => env[vocabularyEnvKey(item.id)] !== undefined)) return {};
  const legacy = parseVocabulary(env.GEMINI_TRANSCRIBE_VOCABULARY);
  if (legacy.join(',') === LEGACY_VOCABULARY.join(',')) return {};
  return { [vocabularyEnvKey(skill)]: legacy.join(',') };
}

function getSkillVocabulary(skill = 'dsa', env = process.env) {
  if (!skills.some(item => item.id === skill)) skill = 'dsa';
  const key = vocabularyEnvKey(skill);
  const legacy = legacyVocabularyUpdates(env);
  return parseVocabulary(env[key] ?? legacy[key] ?? SKILL_VOCABULARIES[skill]);
}

function parseVocabulary(value = '') {
  if (typeof value === 'string') {
    if (value.length > 4096 || /[\r\n]/.test(value)) throw new Error('Invalid transcription vocabulary');
    value = value.split(',').filter(term => term.trim());
  }
  if (!Array.isArray(value) || value.length > 100) throw new Error('Use at most 100 transcription terms');
  const result = [];
  for (const term of value) {
    if (typeof term !== 'string' || !term.trim() || term.length > 100 || /[\r\n,\x00-\x1f]/.test(term)) throw new Error('Invalid transcription term');
    if (!result.includes(term.trim())) result.push(term.trim());
  }
  if (result.join(',').length > 4096) throw new Error('Transcription vocabulary is too long');
  return result;
}

module.exports = { DEFAULT_VOCABULARY, SKILL_VOCABULARIES, parseVocabulary, vocabularyEnvKey, getSkillVocabulary, legacyVocabularyUpdates };
