const fs = require('fs');
let text = fs.readFileSync('src/pages/Auctions.tsx', 'utf-8');

// Count conflicts before
const conflictsBefore = (text.match(/<<<<<<<|=======/g) || []).length;
console.log(`Found ${conflictsBefore / 2} conflict regions`);

// ===== CONFLICT 1 (lines ~85-91): Quote style for emd/preBidDdg init =====
// Keep alan/dev (single quotes)
text = text.replace(
  /<<<<<<< HEAD\r?\n        let emdVal = parsed\.depositDetails\.emd \|\| '';\r?\n        let preBidDdg = parsed\.depositDetails\.preBidDdg \|\| 'Not required for registered MSME bidders';\r?\n=======\r?\n        let emdVal = parsed\.depositDetails\.emd \|\| "";\r?\n        let preBidDdg = parsed\.depositDetails\.preBidDdg \|\| "Not required for registered MSME bidders";\r?\n>>>>>>> origin\/ambdi\/updatednew/,
  `        let emdVal = parsed.depositDetails.emd || '';
        let preBidDdg = parsed.depositDetails.preBidDdg || 'Not required for registered MSME bidders';`
);

// ===== CONFLICT 2 (lines ~116-122): finalPreBid logic =====
// Keep ambdi's finalPreBid logic but also keep the george fix (if (!parsed.depositDetails.preBidDdg)) that's already in the non-conflict area
text = text.replace(
  /<<<<<<< HEAD\r?\n=======\r?\n\r?\n        const finalPreBid = preBidDdg && !preBidDdg\.toLowerCase\(\)\.includes\('not required'\)\r?\n          \? preBidDdg\r?\n          : fallbackPreBid;\r?\n>>>>>>> origin\/ambdi\/updatednew/,
  ``
);

// ===== CONFLICT 3 (lines ~605-611): loadData dependency array =====
// Keep ambdi's version (regionalOffices.join, locations.join)
text = text.replace(
  /<<<<<<< HEAD\r?\n    regionalOffice,\r?\n    location,\r?\n=======\r?\n    regionalOffices\.join\(','\),\r?\n    locations\.join\(','\),\r?\n>>>>>>> origin\/ambdi\/updatednew/,
  `    regionalOffices.join(','),
    locations.join(','),`
);

// ===== CONFLICT 4 (lines ~658-671): loadMstcData dependency array =====
// Keep ambdi's explicit deps
text = text.replace(
  /<<<<<<< HEAD\r?\n  }, \[searchParams\.toString\(\), startDate, endDate\]\);\r?\n=======\r?\n  }, \[\r?\n    searchQuery,\r?\n    selectedMstcCategories\.join\(','\),\r?\n    selectedMstcSubcategories\.join\(','\),\r?\n    selectedMstcLocations\.join\(','\),\r?\n    selectedMstcSellers\.join\(','\),\r?\n    selectedMstcRegionalOffices\.join\(','\),\r?\n    startDate,\r?\n    endDate\r?\n  \]\);\r?\n>>>>>>> origin\/ambdi\/updatednew/,
  `  }, [
    searchQuery,
    selectedMstcCategories.join(','),
    selectedMstcSubcategories.join(','),
    selectedMstcLocations.join(','),
    selectedMstcSellers.join(','),
    selectedMstcRegionalOffices.join(','),
    startDate,
    endDate
  ]);`
);

// ===== CONFLICT 5 (lines ~794-806): handleFilterChange regionalOffices =====
// Keep ambdi's version (multi-select support)
text = text.replace(
  /<<<<<<< HEAD\r?\n      \/\/ Update regionalOffice\r?\n      if \('regionalOffice' in newFilters\) \{\r?\n=======\r?\n      \/\/ Update regionalOffices\r?\n      if \('regionalOffices' in newFilters\) \{\r?\n        next\.delete\('regionalOffice'\);\r?\n        if \(newFilters\.regionalOffices && newFilters\.regionalOffices\.length > 0\) \{\r?\n          newFilters\.regionalOffices\.forEach\(office => next\.append\('regionalOffice', office\)\);\r?\n        \}\r?\n      \} else if \('regionalOffice' in newFilters\) \{\r?\n        next\.delete\('regionalOffice'\);\r?\n>>>>>>> origin\/ambdi\/updatednew/,
  `      // Update regionalOffices
      if ('regionalOffices' in newFilters) {
        next.delete('regionalOffice');
        if (newFilters.regionalOffices && newFilters.regionalOffices.length > 0) {
          newFilters.regionalOffices.forEach(office => next.append('regionalOffice', office));
        }
      } else if ('regionalOffice' in newFilters) {
        next.delete('regionalOffice');`
);

// ===== CONFLICT 6 (lines ~1017-1021): Sidebar filter div class =====
// Keep ambdi's version (overflow-visible)
text = text.replace(
  /<<<<<<< HEAD\r?\n          <div className="lg:w-1\/4 shrink-0 lg:sticky lg:top-\[96px\] lg:max-h-\[calc\(100vh-120px\)\] lg:overflow-y-auto custom-scrollbar z-20">\r?\n=======\r?\n          <div className="lg:w-1\/4 shrink-0 lg:sticky lg:top-\[96px\] lg:overflow-visible z-20">\r?\n>>>>>>> origin\/ambdi\/updatednew/,
  `          <div className="lg:w-1/4 shrink-0 lg:sticky lg:top-[96px] lg:overflow-visible z-20">`
);

// ===== CONFLICT 7 (lines ~1281-2120): MstcDetailsModal vs inline modal =====
// Keep ambdi's inline modal (it has the Financial Terms + Inspection sections)
// but we need to discard alan/dev's MstcDetailsModal reference
text = text.replace(
  /<<<<<<< HEAD\r?\n        <MstcDetailsModal\r?\n          item=\{selectedPreviewItem\}\r?\n          onClose=\{\(\) => setSelectedPreviewItem\(null\)\}\r?\n          isInterested=\{interestedMstcIds\.includes\(selectedPreviewItem\.id\)\}\r?\n          onInterestedToggle=\{\(\) => handleMstcInterestedToggle\(selectedPreviewItem\.id\)\}\r?\n        \/>\r?\n=======/,
  `=======`
);

// Now remove the ======= and >>>>>>> markers around the ambdi content
text = text.replace(
  /=======\r?\n        <div className="fixed inset-0 z-50/,
  `        <div className="fixed inset-0 z-50`
);

// Remove the trailing >>>>>>> marker
text = text.replace(
  />>>>>>> origin\/ambdi\/updatednew\r?\n      \)\}\r?\n    <\/div>\r?\n  \);\r?\n\}/,
  `      )}
    </div>
  );
}`
);

fs.writeFileSync('src/pages/Auctions.tsx', text);

// Count conflicts after
const textAfter = fs.readFileSync('src/pages/Auctions.tsx', 'utf-8');
const conflictsAfter = (textAfter.match(/<<<<<<<|>>>>>>>/g) || []).length;
console.log(`Conflicts remaining: ${conflictsAfter / 2}`);
