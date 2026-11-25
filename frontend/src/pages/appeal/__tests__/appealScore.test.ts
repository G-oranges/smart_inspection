import { describe, expect, it } from 'vitest';

import {
  buildDeductionAdjustments,
  createEditableDeductionDrafts,
  diffDeductionSnapshots,
  previewAdjustedScore,
  resolveMaxCountForItem,
} from '../appealScore';

describe('appealScore utilities', () => {
  const sampleDeductionItems = [
    { code: 'BALCONY', name: '阳台杂物', points: 4, enabled: true, maxPoints: 12 },
    { code: 'TRASH', name: '垃圾未倒', points: 2, enabled: true },
    { code: 'APPLIANCE', name: '违规电器', points: 10, enabled: true, maxPoints: 10 },
  ];

  it('sorts disputed rows first and calculates maxCount from maxPoints', () => {
    const drafts = createEditableDeductionDrafts(
      [
        {
          code: 'TRASH',
          name: '垃圾未倒',
          points: 2,
          count: 2,
          locations: ['门口'],
          disputed: false,
        },
        {
          code: 'BALCONY',
          name: '阳台杂物',
          points: 4,
          count: 1,
          locations: ['阳台'],
          disputed: true,
        },
      ],
      sampleDeductionItems,
    );

    expect(drafts[0].code).toBe('BALCONY');
    expect(drafts[0].maxCount).toBe(3);
    expect(drafts[1].code).toBe('TRASH');
    expect(drafts[1].maxCount).toBeNull();
    expect(resolveMaxCountForItem(10, 10)).toBe(1);
  });

  it('previews score increase, decrease, and 0-100 clamping accurately', () => {
    const drafts = createEditableDeductionDrafts(
      [
        {
          code: 'BALCONY',
          name: '阳台杂物',
          points: 4,
          count: 2,
          locations: ['阳台'],
          disputed: true,
        },
      ],
      sampleDeductionItems,
    );

    // Original score 88 (base 96 - 8). Removing BALCONY restores +8 -> 96.
    const removedDrafts = drafts.map((d) => ({ ...d, removed: true }));
    expect(previewAdjustedScore(removedDrafts, 88)).toEqual({
      originalScore: 88,
      nextScore: 96,
      delta: 8,
      oldDeductionTotal: 8,
      newDeductionTotal: 0,
    });

    // Adding APPLIANCE (-10) drops score from 88 to 78 (-10).
    const addedDrafts = [
      ...drafts,
      {
        code: 'APPLIANCE',
        name: '违规电器',
        points: 10,
        maxCount: 1,
        initialCount: null,
        count: 1,
        initialLocations: [],
        locations: ['桌面'],
        disputed: false,
        removed: false,
        isAdded: true,
      },
    ];
    expect(previewAdjustedScore(addedDrafts, 88)).toEqual({
      originalScore: 88,
      nextScore: 78,
      delta: -10,
      oldDeductionTotal: 8,
      newDeductionTotal: 18,
    });

    expect(buildDeductionAdjustments(addedDrafts)).toEqual([
      {
        code: 'APPLIANCE',
        action: 'add',
        count: 1,
        locations: ['桌面'],
      },
    ]);
  });

  it('produces accurate before/after diff rows for detail view', () => {
    const diffs = diffDeductionSnapshots(
      [
        { code: 'BALCONY', count: 2, locations: ['阳台'], points: 4 },
        { code: 'TRASH', count: 3, locations: ['门口'], points: 2 },
      ],
      [
        { code: 'TRASH', count: 1, locations: ['门口'], points: 2 },
        { code: 'APPLIANCE', count: 1, locations: ['桌面'], points: 10 },
      ],
      ['BALCONY'],
      sampleDeductionItems,
    );

    expect(diffs).toEqual([
      expect.objectContaining({
        code: 'BALCONY',
        kind: 'removed',
        beforeCount: 2,
        afterCount: null,
        disputed: true,
      }),
      expect.objectContaining({
        code: 'TRASH',
        kind: 'updated',
        beforeCount: 3,
        afterCount: 1,
      }),
      expect.objectContaining({
        code: 'APPLIANCE',
        kind: 'added',
        beforeCount: null,
        afterCount: 1,
      }),
    ]);
  });
});
