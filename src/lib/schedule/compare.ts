export type MatchMethod = "AC" | "ExactName" | "FuzzyName" | "UID" | "Heuristic";

export type MatchableTask = {
  key: string;
  matchKey: string;
  taskName: string;
  wbs: string;
  taskId?: string | null;
  activityCode: string | null;
  discipline: string | null;
  area: string | null;
  startDate: string | null;
  finishDate: string | null;
  durationDays: number | null;
};

export type MatchedTaskPair<T extends MatchableTask> = {
  oldTask: T | null;
  newTask: T | null;
  matchConfidence: number;
  matchMethod: MatchMethod;
};

export type MatchOptions = {
  confidenceThreshold?: number;
  allowUidFallback?: boolean;
};

type BucketInfo = {
  signature: string;
  tokens: string[];
};

export function normalizeMatchText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/[^\p{L}\p{N}\s.]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeMatchKey(wbs: string | null | undefined, taskName: string | null | undefined): string {
  const nwbs = normalizeMatchText(wbs || "").replace(/\s+/g, "");
  const nname = normalizeMatchText(taskName || "");
  if (!nwbs && !nname) return "";
  if (!nwbs) return `name:${nname}`;
  if (!nname) return `wbs:${nwbs}`;
  return `${nwbs}|${nname}`;
}

function normalizeActivityCode(value: string | null | undefined): string {
  const normalized = (value || "").trim().toLowerCase().replace(/[^a-z0-9._/-]+/g, "");
  return normalized;
}

function normalizeUid(value: string | null | undefined): string {
  return (value || "").trim().toLowerCase();
}

function tokenize(value: string): string[] {
  const n = normalizeMatchText(value);
  if (!n) return [];
  return n.split(" ").filter(Boolean);
}

function jaro(s1: string, s2: string): number {
  if (s1 === s2) return 1;
  if (!s1 || !s2) return 0;

  const len1 = s1.length;
  const len2 = s2.length;
  const maxDist = Math.floor(Math.max(len1, len2) / 2) - 1;
  const matches1 = new Array<boolean>(len1).fill(false);
  const matches2 = new Array<boolean>(len2).fill(false);

  let matches = 0;
  for (let i = 0; i < len1; i += 1) {
    const start = Math.max(0, i - maxDist);
    const end = Math.min(i + maxDist + 1, len2);
    for (let j = start; j < end; j += 1) {
      if (matches2[j]) continue;
      if (s1[i] !== s2[j]) continue;
      matches1[i] = true;
      matches2[j] = true;
      matches += 1;
      break;
    }
  }
  if (matches === 0) return 0;

  let transpositions = 0;
  let k = 0;
  for (let i = 0; i < len1; i += 1) {
    if (!matches1[i]) continue;
    while (!matches2[k]) k += 1;
    if (s1[i] !== s2[k]) transpositions += 1;
    k += 1;
  }

  return (
    (matches / len1 + matches / len2 + (matches - transpositions / 2) / matches) / 3
  );
}

function jaroWinkler(s1: string, s2: string): number {
  const j = jaro(s1, s2);
  const prefixLimit = 4;
  let prefix = 0;
  for (let i = 0; i < Math.min(prefixLimit, s1.length, s2.length); i += 1) {
    if (s1[i] !== s2[i]) break;
    prefix += 1;
  }
  return j + prefix * 0.1 * (1 - j);
}

function tokenOverlap(a: string, b: string): number {
  const ta = tokenize(a);
  const tb = tokenize(b);
  if (!ta.length || !tb.length) return 0;
  const aset = new Set(ta);
  const bset = new Set(tb);
  let common = 0;
  for (const token of aset) {
    if (bset.has(token)) common += 1;
  }
  return common / Math.max(aset.size, bset.size);
}

function daysBetween(a: string | null, b: string | null): number | null {
  if (!a || !b) return null;
  const da = new Date(`${a}T00:00:00Z`);
  const db = new Date(`${b}T00:00:00Z`);
  if (Number.isNaN(da.getTime()) || Number.isNaN(db.getTime())) return null;
  return Math.round((db.getTime() - da.getTime()) / 86400000);
}

function durationProximity(a: number | null, b: number | null): number {
  if (a === null || b === null) return 0.55;
  const max = Math.max(Math.abs(a), Math.abs(b), 1);
  const diff = Math.abs(a - b);
  return Math.max(0, 1 - diff / max);
}

function dateProximity(oldTask: MatchableTask, newTask: MatchableTask): number {
  const startDiff = daysBetween(oldTask.startDate, newTask.startDate);
  const finishDiff = daysBetween(oldTask.finishDate, newTask.finishDate);
  const avgDiff = (Math.abs(startDiff ?? 40) + Math.abs(finishDiff ?? 40)) / 2;
  return Math.max(0, 1 - avgDiff / 45);
}

function splitAcTokens(ac: string | null): string[] {
  return (ac || "")
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
}

function inferBucket(task: MatchableTask): BucketInfo {
  const acTokens = splitAcTokens(task.activityCode);
  const filtered = acTokens.filter((token) => !/^a?\d{2,4}$/.test(token));
  const discipline = normalizeMatchText(task.discipline || "");
  const area = normalizeMatchText(task.area || "");

  const disciplineToken = discipline || filtered[0] || "";
  const zoneToken =
    area ||
    filtered.find((token) => /^(?:z|zone|l|lvl|level)\d+[a-z0-9]*$/i.test(token)) ||
    filtered[1] ||
    "";
  const systemToken =
    filtered.find((token) => /^(?:sys|system|trk|tray|pipe|duct|civ|elec|mech|inst|arch|str)/i.test(token)) ||
    filtered[2] ||
    "";

  const tokens = [disciplineToken, zoneToken, systemToken].filter(Boolean);
  return {
    signature: tokens.join("|"),
    tokens,
  };
}

function bucketsCompatible(left: BucketInfo, right: BucketInfo): boolean {
  if (!left.tokens.length && !right.tokens.length) return true;
  if (!left.tokens.length || !right.tokens.length) return false;

  const leftSet = new Set(left.tokens);
  const rightSet = new Set(right.tokens);
  let overlap = 0;
  for (const token of leftSet) {
    if (rightSet.has(token)) overlap += 1;
  }
  return overlap > 0;
}

function candidateScore(oldTask: MatchableTask, newTask: MatchableTask): number {
  const nameA = normalizeMatchText(oldTask.taskName);
  const nameB = normalizeMatchText(newTask.taskName);
  const wbsA = normalizeMatchText(oldTask.wbs);
  const wbsB = normalizeMatchText(newTask.wbs);
  const bucketA = inferBucket(oldTask);
  const bucketB = inferBucket(newTask);

  const nameScore = Math.max(jaroWinkler(nameA, nameB), tokenOverlap(nameA, nameB));
  const wbsScore = wbsA && wbsB ? Math.max(jaroWinkler(wbsA, wbsB), tokenOverlap(wbsA, wbsB)) : 0.4;
  const durationScore = durationProximity(oldTask.durationDays, newTask.durationDays);
  const dateScore = dateProximity(oldTask, newTask);
  const bucketBonus = bucketsCompatible(bucketA, bucketB) ? 0.08 : -0.1;

  const score = nameScore * 0.6 + wbsScore * 0.12 + durationScore * 0.14 + dateScore * 0.14 + bucketBonus;
  return Math.max(0, Math.min(1, Number(score.toFixed(4))));
}

function addMatch<T extends MatchableTask>(
  pairs: MatchedTaskPair<T>[],
  oldTask: T | null,
  newTask: T | null,
  confidence: number,
  method: MatchMethod
) {
  pairs.push({
    oldTask,
    newTask,
    matchConfidence: Math.max(0, Math.min(1, Number(confidence.toFixed(4)))),
    matchMethod: method,
  });
}

function buildIndex<T extends MatchableTask>(tasks: T[]) {
  return new Map(tasks.map((task) => [task.key, task]));
}

function pairGroupsByScore<T extends MatchableTask>(
  oldGroup: T[],
  newGroup: T[],
  fallbackConfidence: number,
  method: MatchMethod
): Array<{ oldTask: T; newTask: T; confidence: number; method: MatchMethod }> {
  const ranked: Array<{ oldTask: T; newTask: T; score: number }> = [];
  for (const oldTask of oldGroup) {
    for (const newTask of newGroup) {
      ranked.push({ oldTask, newTask, score: candidateScore(oldTask, newTask) });
    }
  }
  ranked.sort((a, b) => b.score - a.score || a.oldTask.key.localeCompare(b.oldTask.key));

  const usedOld = new Set<string>();
  const usedNew = new Set<string>();
  const pairs: Array<{ oldTask: T; newTask: T; confidence: number; method: MatchMethod }> = [];

  for (const pair of ranked) {
    if (usedOld.has(pair.oldTask.key) || usedNew.has(pair.newTask.key)) continue;
    usedOld.add(pair.oldTask.key);
    usedNew.add(pair.newTask.key);

    const confidence = method === "AC" ? 1 : Math.max(fallbackConfidence, pair.score);
    pairs.push({ oldTask: pair.oldTask, newTask: pair.newTask, confidence, method });
  }

  return pairs;
}

function buildUidBuckets<T extends MatchableTask>(tasks: T[], keys: Set<string>, index: Map<string, T>) {
  const map = new Map<string, T[]>();
  for (const key of keys) {
    const task = index.get(key);
    if (!task) continue;
    const uid = normalizeUid(task.taskId || null);
    if (!uid) continue;
    const list = map.get(uid) ?? [];
    list.push(task);
    map.set(uid, list);
  }
  return map;
}

export function matchScheduleTasks<T extends MatchableTask>(
  oldTasks: T[],
  newTasks: T[],
  options: MatchOptions = {}
): MatchedTaskPair<T>[] {
  const threshold = options.confidenceThreshold ?? 0.7;
  const allowUidFallback = options.allowUidFallback ?? false;
  const pairs: MatchedTaskPair<T>[] = [];
  const oldByKey = buildIndex(oldTasks);
  const newByKey = buildIndex(newTasks);
  const unmatchedOld = new Set(oldTasks.map((task) => task.key));
  const unmatchedNew = new Set(newTasks.map((task) => task.key));

  const takePair = (oldTask: T, newTask: T, confidence: number, method: MatchMethod) => {
    if (!unmatchedOld.has(oldTask.key) || !unmatchedNew.has(newTask.key)) return;
    unmatchedOld.delete(oldTask.key);
    unmatchedNew.delete(newTask.key);
    addMatch(pairs, oldTask, newTask, confidence, method);
  };

  // 1) Exact match by activity code.
  const oldByAc = new Map<string, T[]>();
  const newByAc = new Map<string, T[]>();
  for (const task of oldTasks) {
    const ac = normalizeActivityCode(task.activityCode);
    if (!ac) continue;
    const list = oldByAc.get(ac) ?? [];
    list.push(task);
    oldByAc.set(ac, list);
  }
  for (const task of newTasks) {
    const ac = normalizeActivityCode(task.activityCode);
    if (!ac) continue;
    const list = newByAc.get(ac) ?? [];
    list.push(task);
    newByAc.set(ac, list);
  }

  for (const [ac, oldGroupAll] of oldByAc.entries()) {
    const newGroupAll = newByAc.get(ac);
    if (!newGroupAll || !oldGroupAll.length || !newGroupAll.length) continue;

    const oldGroup = oldGroupAll.filter((task) => unmatchedOld.has(task.key));
    const newGroup = newGroupAll.filter((task) => unmatchedNew.has(task.key));
    if (!oldGroup.length || !newGroup.length) continue;

    const grouped = pairGroupsByScore(oldGroup, newGroup, 1, "AC");
    grouped.forEach((pair) => takePair(pair.oldTask, pair.newTask, pair.confidence, pair.method));
  }

  // 2) Exact normalized name inside discipline/zone/system bucket.
  const oldByNameBucket = new Map<string, T[]>();
  const newByNameBucket = new Map<string, T[]>();
  const nameBucketKey = (task: T) => {
    const name = normalizeMatchText(task.taskName);
    const bucket = inferBucket(task).signature;
    return `${bucket}|${name}`;
  };

  for (const key of unmatchedOld) {
    const task = oldByKey.get(key);
    if (!task) continue;
    const nname = normalizeMatchText(task.taskName);
    if (!nname) continue;
    const list = oldByNameBucket.get(nameBucketKey(task)) ?? [];
    list.push(task);
    oldByNameBucket.set(nameBucketKey(task), list);
  }
  for (const key of unmatchedNew) {
    const task = newByKey.get(key);
    if (!task) continue;
    const nname = normalizeMatchText(task.taskName);
    if (!nname) continue;
    const list = newByNameBucket.get(nameBucketKey(task)) ?? [];
    list.push(task);
    newByNameBucket.set(nameBucketKey(task), list);
  }

  for (const [bucketName, oldGroupAll] of oldByNameBucket.entries()) {
    const newGroupAll = newByNameBucket.get(bucketName);
    if (!newGroupAll) continue;
    const oldGroup = oldGroupAll.filter((task) => unmatchedOld.has(task.key));
    const newGroup = newGroupAll.filter((task) => unmatchedNew.has(task.key));
    if (!oldGroup.length || !newGroup.length) continue;
    const grouped = pairGroupsByScore(oldGroup, newGroup, 0.92, "ExactName");
    grouped.forEach((pair) => takePair(pair.oldTask, pair.newTask, pair.confidence, pair.method));
  }

  // 3) Fuzzy name matching within compatible discipline/zone/system buckets.
  const oldPool = Array.from(unmatchedOld).map((key) => oldByKey.get(key)).filter(Boolean) as T[];
  const newPool = Array.from(unmatchedNew).map((key) => newByKey.get(key)).filter(Boolean) as T[];
  const scoredPairs: Array<{ oldTask: T; newTask: T; score: number }> = [];

  for (const oldTask of oldPool) {
    const oldBucket = inferBucket(oldTask);
    for (const newTask of newPool) {
      const newBucket = inferBucket(newTask);
      if (!bucketsCompatible(oldBucket, newBucket)) continue;

      const score = candidateScore(oldTask, newTask);
      if (score < threshold) continue;
      scoredPairs.push({ oldTask, newTask, score });
    }
  }

  scoredPairs.sort((a, b) => b.score - a.score || a.oldTask.key.localeCompare(b.oldTask.key));
  for (const pair of scoredPairs) {
    const confidence = Math.max(0.7, Math.min(0.89, pair.score));
    takePair(pair.oldTask, pair.newTask, confidence, "FuzzyName");
  }

  // 4) UID fallback only for same-lineage revisions.
  if (allowUidFallback) {
    const oldByUid = buildUidBuckets(oldTasks, unmatchedOld, oldByKey);
    const newByUid = buildUidBuckets(newTasks, unmatchedNew, newByKey);
    for (const [uid, oldGroupAll] of oldByUid.entries()) {
      const newGroupAll = newByUid.get(uid);
      if (!newGroupAll) continue;
      const oldGroup = oldGroupAll.filter((task) => unmatchedOld.has(task.key));
      const newGroup = newGroupAll.filter((task) => unmatchedNew.has(task.key));
      if (!oldGroup.length || !newGroup.length) continue;

      const grouped = pairGroupsByScore(oldGroup, newGroup, 0.62, "UID");
      grouped.forEach((pair) => takePair(pair.oldTask, pair.newTask, pair.confidence, pair.method));
    }
  }

  // 5) Remaining unmatched are ADDED/REMOVED.
  for (const key of unmatchedOld) {
    const oldTask = oldByKey.get(key);
    if (oldTask) addMatch(pairs, oldTask, null, 0, "Heuristic");
  }
  for (const key of unmatchedNew) {
    const newTask = newByKey.get(key);
    if (newTask) addMatch(pairs, null, newTask, 0, "Heuristic");
  }

  return pairs;
}
