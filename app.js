const OWNED_STORAGE_KEY = "sprite-collection.owned";
const MASTERED_STORAGE_KEY = "sprite-collection.mastered";
const QUANTITY_STORAGE_KEY = "sprite-collection.quantity";
const LOST_STORAGE_KEY = "sprite-collection.lost";
const LEGACY_CONFIRMED_STORAGE_KEY = "sprite-collection.confirmed";

const els = {
  emptyState: document.getElementById("emptyState"),
  exportOwnedBtn: document.getElementById("exportOwnedBtn"),
  missingCount: document.getElementById("missingCount"),
  ownedCount: document.getElementById("ownedCount"),
  resetOwnedBtn: document.getElementById("resetOwnedBtn"),
  searchInput: document.getElementById("searchInput"),
  spriteCount: document.getElementById("spriteCount"),
  spriteGallery: document.getElementById("spriteGallery"),
  template: document.getElementById("spriteCardTemplate"),
  totalCount: document.getElementById("totalCount"),
  sortSelect: document.getElementById("sortSelect")
};

const sprites = (window.SPRITE_TEMPLATES || []).map(normalizeSprite).filter(Boolean);
let ownedSprites = new Set(readOwned());
let masteredSprites = new Set(readSet(MASTERED_STORAGE_KEY));
let lostSprites = new Set(readSet(LOST_STORAGE_KEY));
let spriteQuantities = readQuantity();

function normalizeSprite(sprite) {
  if (!sprite?.officialId || !sprite?.name) {
    return null;
  }

  const variant = Boolean(sprite.variant);
  return {
    officialId: String(sprite.officialId).trim(),
    name: String(sprite.name).trim(),
    type: String(sprite.type || "Unknown").trim(),
    rarity: String(sprite.rarity || "Common").trim(),
    chance: String(sprite.chance || "").trim(),
    variant,
    variantType: variant ? String(sprite.variantType || "Variant").trim() : null,
    image: String(sprite.image || "").trim()
  };
}

function readOwned() {
  try {
    const saved = JSON.parse(localStorage.getItem(OWNED_STORAGE_KEY));
    if (Array.isArray(saved)) {
      return saved;
    }

    const legacy = JSON.parse(localStorage.getItem(LEGACY_CONFIRMED_STORAGE_KEY));
    return Array.isArray(legacy) ? legacy : [];
  } catch {
    return [];
  }
}

function readSet(key) {
  try {
    const saved = JSON.parse(localStorage.getItem(key));
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function readQuantity() {
  try {
    const saved = JSON.parse(localStorage.getItem(QUANTITY_STORAGE_KEY));
    return saved && typeof saved === "object" && !Array.isArray(saved) ? saved : {};
  } catch {
    return {};
  }
}

function saveOwned() {
  const knownIds = new Set(sprites.map((sprite) => sprite.officialId));
  ownedSprites = new Set([...ownedSprites].filter((id) => knownIds.has(id)));
  localStorage.setItem(OWNED_STORAGE_KEY, JSON.stringify([...ownedSprites]));
}

function saveMastered() {
  const knownIds = new Set(sprites.map((sprite) => sprite.officialId));
  masteredSprites = new Set([...masteredSprites].filter((id) => knownIds.has(id)));
  localStorage.setItem(MASTERED_STORAGE_KEY, JSON.stringify([...masteredSprites]));
}

function saveLost() {
  const knownIds = new Set(sprites.map((sprite) => sprite.officialId));
  lostSprites = new Set([...lostSprites].filter((id) => knownIds.has(id)));
  localStorage.setItem(LOST_STORAGE_KEY, JSON.stringify([...lostSprites]));
}

function saveQuantity() {
  const knownIds = new Set(sprites.map((sprite) => sprite.officialId));
  spriteQuantities = Object.fromEntries(
    Object.entries(spriteQuantities)
      .filter(([id]) => knownIds.has(id))
      .map(([id, value]) => [id, clampQuantity(value)])
  );
  localStorage.setItem(QUANTITY_STORAGE_KEY, JSON.stringify(spriteQuantities));
}

function clampQuantity(value) {
  return Math.min(5, Math.max(1, Number(value) || 1));
}

function quantityFor(officialId) {
  return clampQuantity(spriteQuantities[officialId]);
}

function rarityClass(rarity) {
  return `rarity-${String(rarity || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

function rarityRank(rarity) {
  const ranks = {
    common: 1,
    uncommon: 2,
    rare: 3,
    epic: 4,
    legendary: 5,
    mythic: 6,
    special: 7
  };
  return ranks[String(rarity || "").toLowerCase()] || 0;
}

function matchesFilters(sprite) {
  const query = els.searchInput.value.trim().toLowerCase();
  const searchable = [sprite.officialId, sprite.name, sprite.type, sprite.rarity, sprite.variantType, sprite.chance]
    .join(" ")
    .toLowerCase();

  return !query || searchable.includes(query);
}

function sortSprites(list) {
  const sorted = [...list];
  const byName = (a, b) => a.name.localeCompare(b.name);
  const boolSort = (fn) => (a, b) => Number(fn(b)) - Number(fn(a)) || byName(a, b);

  switch (els.sortSelect.value) {
    case "rarity":
    case "rare-to-common":
      return sorted.sort((a, b) => rarityRank(b.rarity) - rarityRank(a.rarity) || byName(a, b));
    case "common-to-rare":
      return sorted.sort((a, b) => rarityRank(a.rarity) - rarityRank(b.rarity) || byName(a, b));
    case "owned":
      return sorted.sort(boolSort((sprite) => ownedSprites.has(sprite.officialId)));
    case "lost":
      return sorted.sort(boolSort((sprite) => lostSprites.has(sprite.officialId)));
    case "missing":
      return sorted.sort(boolSort((sprite) => !ownedSprites.has(sprite.officialId)));
    case "variant":
      return sorted.sort(boolSort((sprite) => sprite.variant));
    case "type":
    default:
      return sorted.sort((a, b) => a.type.localeCompare(b.type) || byName(a, b));
  }
}

function renderSummary() {
  saveOwned();
  saveMastered();
  saveLost();
  saveQuantity();
  const owned = ownedSprites.size;
  els.totalCount.textContent = String(sprites.length);
  els.ownedCount.textContent = String(owned);
  els.missingCount.textContent = String(Math.max(sprites.length - owned, 0));
}

function renderGallery() {
  renderSummary();

  const filtered = sortSprites(sprites.filter(matchesFilters));
  els.spriteGallery.innerHTML = "";
  els.spriteCount.textContent = `${filtered.length} shown`;
  els.emptyState.hidden = filtered.length > 0;

  filtered.forEach((sprite) => {
    const card = els.template.content.firstElementChild.cloneNode(true);
    const chanceBubble = card.querySelector(".chance-bubble");
    const img = card.querySelector("img");
    const fallback = card.querySelector(".sprite-art span");
    const mainButton = card.querySelector(".sprite-main");
    const title = card.querySelector("strong");
    const badge = card.querySelector(".have-badge");
    const masteryBox = card.querySelector(".mastery-box");
    const lostBox = card.querySelector(".lost-box");
    const quantityMinus = card.querySelector(".quantity-minus");
    const quantityPlus = card.querySelector(".quantity-plus");
    const quantityValue = card.querySelector(".quantity-control strong");
    const isOwned = ownedSprites.has(sprite.officialId);
    const isMastered = masteredSprites.has(sprite.officialId);
    const isLost = lostSprites.has(sprite.officialId);
    const quantity = quantityFor(sprite.officialId);

    card.classList.toggle("owned", isOwned);
    card.classList.toggle("mastered", isMastered);
    card.classList.toggle("lost", isLost);
    mainButton.setAttribute("aria-pressed", String(isOwned));
    mainButton.setAttribute("aria-label", `${isOwned ? "Remove owned" : "Mark owned"} ${sprite.name}`);
    masteryBox.setAttribute("aria-pressed", String(isMastered));
    masteryBox.setAttribute("aria-label", `${isMastered ? "Remove mastered" : "Mark mastered"} ${sprite.name}`);
    masteryBox.disabled = !isOwned;
    lostBox.setAttribute("aria-pressed", String(isLost));
    lostBox.setAttribute("aria-label", `${isLost ? "Remove lost" : "Mark lost"} ${sprite.name}`);
    lostBox.disabled = !isOwned;
    title.textContent = sprite.name;
    chanceBubble.textContent = sprite.chance || "??";
    badge.textContent = sprite.rarity;
    badge.classList.add(rarityClass(sprite.rarity));
    card.dataset.state = isOwned ? "Owned" : "Missing";
    quantityValue.textContent = String(quantity);

    if (sprite.image) {
      img.src = sprite.image;
      img.alt = sprite.name;
      img.hidden = false;
      fallback.hidden = true;
      img.addEventListener("error", () => showFallback(img, fallback, sprite), { once: true });
    } else {
      showFallback(img, fallback, sprite);
    }

    masteryBox.addEventListener("click", () => toggleMastered(sprite.officialId));
    lostBox.addEventListener("click", () => toggleLost(sprite.officialId));
    quantityMinus.addEventListener("click", () => changeQuantity(sprite.officialId, -1));
    quantityPlus.addEventListener("click", () => changeQuantity(sprite.officialId, 1));
    mainButton.addEventListener("click", () => toggleOwned(sprite.officialId));
    els.spriteGallery.append(card);
  });
}

function showFallback(img, fallback, sprite) {
  img.hidden = true;
  img.removeAttribute("src");
  fallback.hidden = false;
  fallback.textContent = (sprite.type || sprite.name || "?").slice(0, 2).toUpperCase();
}

function toggleOwned(officialId) {
  if (ownedSprites.has(officialId)) {
    ownedSprites.delete(officialId);
    masteredSprites.delete(officialId);
    lostSprites.delete(officialId);
  } else {
    ownedSprites.add(officialId);
  }

  saveOwned();
  saveMastered();
  saveLost();
  renderGallery();
}

function toggleMastered(officialId) {
  if (!ownedSprites.has(officialId)) {
    return;
  }

  if (masteredSprites.has(officialId)) {
    masteredSprites.delete(officialId);
  } else {
    masteredSprites.add(officialId);
  }

  saveOwned();
  saveMastered();
  renderGallery();
}

function changeQuantity(officialId, delta) {
  const next = clampQuantity(quantityFor(officialId) + delta);
  spriteQuantities[officialId] = next;
  ownedSprites.add(officialId);

  if (next === 5) {
    masteredSprites.add(officialId);
  }

  saveOwned();
  saveMastered();
  saveQuantity();
  renderGallery();
}

function toggleLost(officialId) {
  if (!ownedSprites.has(officialId)) {
    return;
  }

  if (lostSprites.has(officialId)) {
    lostSprites.delete(officialId);
  } else {
    lostSprites.add(officialId);
  }

  saveLost();
  renderGallery();
}

function exportOwned() {
  const owned = sprites.filter((sprite) => ownedSprites.has(sprite.officialId)).map((sprite) => ({
    ...sprite,
    quantity: quantityFor(sprite.officialId),
    mastered: masteredSprites.has(sprite.officialId),
    lost: lostSprites.has(sprite.officialId)
  }));
  const blob = new Blob([JSON.stringify(owned, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "owned-sprites.json";
  link.click();
  URL.revokeObjectURL(url);
}

els.searchInput.addEventListener("input", renderGallery);
els.sortSelect.addEventListener("change", renderGallery);
els.exportOwnedBtn.addEventListener("click", exportOwned);
els.resetOwnedBtn.addEventListener("click", () => {
  if (!ownedSprites.size || !confirm("Reset owned sprites?")) {
    return;
  }

  ownedSprites.clear();
  masteredSprites.clear();
  lostSprites.clear();
  spriteQuantities = {};
  saveOwned();
  saveMastered();
  saveLost();
  saveQuantity();
  renderGallery();
});

renderGallery();
