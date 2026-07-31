#!/bin/bash
# npm run test:e2e — end-to-end test of the company levels & pay research feature.
#
# Runs the REAL pipeline against the REAL registry: cold start, full run, idempotency,
# the HTTP write path, cross-source preservation, corpus invariants, and the UI renderers.
# It writes to data/company-comp.jsonl and data/postings-personal.jsonl, then cleans up
# the rows it injected — but it is not a read-only test, so don't run it mid-edit.
# End-to-end test of the company levels & pay research feature.
# Runs the real pipeline against the real registry, exercises the HTTP write path,
# and checks the invariants that unit tests can't see (idempotency, cross-run preservation).
S=$(cd "$(dirname "$0")" && pwd)
cd "$S/.."   # repo root, derived — never hardcode an absolute path
PORT=4199
PASS=0; FAIL=0
ok(){ echo "  ✅ $1"; PASS=$((PASS+1)); }
no(){ echo "  ❌ $1"; FAIL=$((FAIL+1)); }
h(){ echo; echo "── $1"; }

h "1. Cold start: no derived files at all"
# Preserve LLM-researched bands across the cold-start test. jd-comp.mjs can regenerate its own
# rows from the registry, but researched ones are irreplaceable — deleting them would make this
# test quietly destroy real work every time it runs.
RESTORE=/tmp/byojb-e2e-preserved-bands.jsonl
node -e '
const fs=require("fs");const p="data/company-comp.jsonl";
if(!fs.existsSync(p)){fs.writeFileSync(process.argv[1],"");process.exit(0)}
const keep=fs.readFileSync(p,"utf8").split("\n").filter(l=>l.trim())
  .filter(l=>{try{return !String(JSON.parse(l).provenance?.collected_by||"").startsWith("ingest/")}catch{return false}});
fs.writeFileSync(process.argv[1],keep.length?keep.join("\n")+"\n":"");
if(keep.length)console.error(`     (preserving ${keep.length} researched band(s) across the cold-start test)`);
' $RESTORE
rm -f data/company-comp.jsonl data/company-aggregates.jsonl
# Every consumer must survive the files being absent.
node score-postings.mjs >/dev/null 2>&1 && ok "score-postings runs with no band registry" || no "score-postings crashed cold"
node llm-triage.mjs --emit-comp 3 >/dev/null 2>&1 && ok "--emit-comp runs with no aggregates" || no "--emit-comp crashed cold"
node llm-triage.mjs --emit-research 3 >/dev/null 2>&1 && ok "--emit-research runs with no aggregates" || no "--emit-research crashed cold"
node doctor.mjs >/dev/null 2>&1 && ok "doctor passes with no band registry" || no "doctor failed cold"

h "2. Full pipeline"
node ingest/jd-comp.mjs >/dev/null 2>&1 && ok "ingest/jd-comp.mjs" || no "ingest/jd-comp.mjs"
node score-postings.mjs >/dev/null 2>&1 && ok "score-postings.mjs" || no "score-postings.mjs"
node company-aggregates.mjs >/dev/null 2>&1 && ok "company-aggregates.mjs" || no "company-aggregates.mjs"
B1=$(wc -l < data/company-comp.jsonl | tr -d ' ')
A1=$(wc -l < data/company-aggregates.jsonl | tr -d ' ')
S1=$(md5 -q data/postings-personal.jsonl)
echo "     bands=$B1 aggregates=$A1"

h "3. Idempotency — a second identical run must converge"
node ingest/jd-comp.mjs >/dev/null 2>&1
node score-postings.mjs >/dev/null 2>&1
node company-aggregates.mjs >/dev/null 2>&1
B2=$(wc -l < data/company-comp.jsonl | tr -d ' ')
A2=$(wc -l < data/company-aggregates.jsonl | tr -d ' ')
S2=$(md5 -q data/postings-personal.jsonl)
[ "$B1" = "$B2" ] && ok "band count stable ($B1)" || no "band count drifted: $B1 → $B2"
[ "$A1" = "$A2" ] && ok "aggregate count stable ($A1)" || no "aggregate count drifted: $A1 → $A2"
[ "$S1" = "$S2" ] && ok "scored postings byte-identical on re-run" || no "scores drifted on re-run"

h "4. HTTP write path (POST /api/company/comp)"
pkill -f "DASHBOARD_PORT=$PORT" 2>/dev/null; sleep 0.5
DASHBOARD_PORT=$PORT node web/server.mjs > /tmp/byojb-e2e-srv.log 2>&1 &
sleep 2.5
KEY="greenhouse:canonical"

# 4a. a well-formed researched band is accepted
R=$(curl -s -X POST localhost:$PORT/api/company/comp -H 'content-type: application/json' -d '{
 "key":"greenhouse:canonical","rows":[
 {"title_family":"platform_infra","ladder_level":"senior","derivation":"inferred",
  "band":{"min":120000,"mid":140000,"max":160000,"currency":"USD","component":"base"},
  "provenance":{"source":"llm_research","method":"e2e test row","confidence":"medium",
   "sample_size":3,"as_of":"2026-07-31","source_urls":["https://canonical.com/careers"]}}]}')
echo "$R" | grep -q '"ok":true' && ok "POST accepts a valid band" || no "POST rejected a valid band: $R"

# 4b. a malformed row is rejected WITH reasons
R=$(curl -s -X POST localhost:$PORT/api/company/comp -H 'content-type: application/json' -d '{
 "key":"greenhouse:canonical","rows":[
 {"title_family":"platform_infra","ladder_level":"senior","derivation":"direct",
  "band":{"min":1},"provenance":{"source":"llm_prior","confidence":"low","as_of":"2026-07-31"}}]}')
echo "$R" | grep -q '"error"' && ok "POST rejects a mislabeled row" || no "POST accepted a bad row: $R"
echo "$R" | grep -q 'implies derivation' && ok "POST returns the specific reason" || no "POST gave no reason"

# 4c. the rejected write must NOT have clobbered the accepted one
G=$(curl -s "localhost:$PORT/api/company?key=$KEY")
echo "$G" | grep -q 'e2e test row' && ok "valid band survived the failed write" || no "failed write clobbered good data"

# 4d. comp note round-trips
curl -s -X POST localhost:$PORT/api/company/comp -H 'content-type: application/json' \
  -d '{"key":"greenhouse:canonical","note":"e2e note check"}' >/dev/null
curl -s "localhost:$PORT/api/company?key=$KEY" | grep -q 'e2e note check' && ok "comp note round-trips" || no "comp note lost"

h "5. The researched band actually reaches scoring"
node score-postings.mjs >/dev/null 2>&1
node -e '
const fs=require("fs");let n=0;
for(const l of fs.readFileSync("data/postings-personal.jsonl","utf8").split("\n")){
 if(!l.trim())continue;const r=JSON.parse(l);
 if(r.comp_band_ref&&r.comp_band_ref.source==="llm_research")n++;}
process.exit(n>0?0:1)' && ok "llm_research band feeds posting scores" || no "researched band never reached scoring"

h "6. Cross-source preservation — rebuilding JD bands must not delete researched ones"
BEFORE=$(grep -c llm_research data/company-comp.jsonl)
node ingest/jd-comp.mjs >/dev/null 2>&1
AFTER=$(grep -c llm_research data/company-comp.jsonl)
[ "$BEFORE" = "$AFTER" ] && [ "$AFTER" -gt 0 ] && ok "llm_research rows preserved across rebuild ($AFTER)" || no "rebuild destroyed researched rows: $BEFORE → $AFTER"

h "6b. Researched bands survive a JD rebuild (ownership is by producer, not source label)"
cat > /tmp/e2e-llm-band.json <<'JEOF'
[{"key":"greenhouse:canonical","title_family":"software_general","ladder_level":"senior","derivation":"direct",
  "band":{"min":100000,"mid":110000,"max":120000,"currency":"USD","component":"base"},
  "provenance":{"source":"jd_posted","method":"e2e ownership row","confidence":"medium","sample_size":1,
   "as_of":"2026-07-31","source_urls":["https://example.com/x"],"collected_by":"llm-research"}}]
JEOF
node llm-triage.mjs --apply-comp /tmp/e2e-llm-band.json >/dev/null 2>&1
node ingest/jd-comp.mjs >/dev/null 2>&1
# jd-comp.mjs also emits source:"jd_posted"; keying ownership on the label would delete this row.
grep -q 'e2e ownership row' data/company-comp.jsonl && ok "an LLM band sharing the jd_posted label survives" || no "rebuild destroyed researched work"
node -e '
const fs=require("fs");const p="data/company-comp.jsonl";
const keep=fs.readFileSync(p,"utf8").split("\n").filter(l=>l.trim()).filter(l=>!/e2e ownership row/.test(l));
fs.writeFileSync(p,keep.join("\n")+"\n");' 

h "7. Invariants over the whole corpus"
node -e '
const fs=require("fs");
let listedOverridden=0,estScored=0,noDeriv=0,rows=0;
for(const l of fs.readFileSync("data/postings-personal.jsonl","utf8").split("\n")){
 if(!l.trim())continue;const p=JSON.parse(l);
 if(p.comp_source&&p.comp_source.startsWith("company_")&&p.dim_scores&&p.comp_band_ref===null)listedOverridden++;
 if(p.comp_source==="company_estimated")estScored++;
}
for(const l of fs.readFileSync("data/company-comp.jsonl","utf8").split("\n")){
 if(!l.trim())continue;const r=JSON.parse(l);rows++;
 if(!["direct","inferred","estimated"].includes(r.derivation))noDeriv++;
 if(!r.key||!r.title_family)noDeriv++;
}
console.log("     band rows:",rows);
// Assert the invariant AGAINST THE ACTUAL SETTING, not against an assumption. Hardcoding
// "estimated never scores" made this fail the moment comp_use_estimated was turned on.
const yaml=require("js-yaml");
const on=(yaml.load(fs.readFileSync("config/rubric.yml","utf8"))||{}).preferences?.comp_use_estimated===true;
if(!on&&estScored){console.error("estimated bands scored while comp_use_estimated is false:",estScored);process.exit(1)}
if(on)console.log("     comp_use_estimated=true →",estScored,"posting(s) scoring on an estimated band (expected)");
if(noDeriv){console.error("rows missing derivation/key/family:",noDeriv);process.exit(1)}
' && ok "no estimated band scored; every row has derivation+key+family" || no "corpus invariant violated"

h "8. UI renderers against live API data"
node "$S/render-check.mjs" && ok "postings + companies renderers produce correct markup" || no "renderer check failed"

h "9. doctor + unit suite on the final state"
node doctor.mjs 2>&1 | grep -q "All checks passed" && ok "doctor passes" || no "doctor failed"
# Assert on FAILURES, not a pinned pass-count — the pass count grows every time a test is added,
# and pinning it makes this alarm on healthy growth. The only tolerated failures are the
# pre-existing absolute-path ones in extract-script.mjs, which predate this feature.
UNIT=$(node test-all.mjs 2>&1)
UNEXPECTED=$(echo "$UNIT" | grep "❌" | grep -cv "Absolute path")
if [ "$UNEXPECTED" = "0" ]; then
  ok "unit suite: no failures outside the known extract-script.mjs path issues ($(echo "$UNIT" | grep -oE '[0-9]+ passed'))"
else
  no "unit suite regressed — $UNEXPECTED unexpected failure(s):"; echo "$UNIT" | grep "❌" | grep -v "Absolute path" | head -5
fi

pkill -f "DASHBOARD_PORT=$PORT" 2>/dev/null

h "10. Cleanup — remove every row this test fabricated, restore preserved work"
node -e '
const fs=require("fs");const p="data/company-comp.jsonl";
const rows=fs.readFileSync(p,"utf8").split("\n").filter(l=>l.trim());
const keep=rows.filter(l=>!/e2e test row/.test(l));
fs.writeFileSync(p,keep.join("\n")+"\n");
process.exit(rows.length===keep.length?1:0)' && ok "fabricated band removed" || no "nothing to clean (test row missing?)"
rm -f data/company-comp/greenhouse-canonical.md; rmdir data/company-comp 2>/dev/null
# put back any researched bands the cold-start step had to move aside
if [ -s "$RESTORE" ]; then
  cat "$RESTORE" >> data/company-comp.jsonl
  ok "restored $(wc -l < "$RESTORE" | tr -d ' ') researched band(s) removed by the cold-start test"
fi
node score-postings.mjs >/dev/null 2>&1 && node company-aggregates.mjs >/dev/null 2>&1
grep -q "e2e test row" data/company-comp.jsonl && no "test data still present" || ok "registry restored to real data only"

echo
echo "════════════════════════════════════"
echo "E2E: $PASS passed, $FAIL failed"
[ "$FAIL" = "0" ] || exit 1
