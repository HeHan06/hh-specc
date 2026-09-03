## 1. 快速排序（Quick Sort）万能模板

```
public void quickSort(int[] nums, int left, int right) {
    if (left >= right) return;
    
    int pivot = nums[left + (right - left) / 2];
    int i = left - 1, j = right + 1;
    
    while (i < j) {
        do i++; while (nums[i] < pivot);
        do j--; while (nums[j] > pivot);
        if (i < j) swap(nums, i, j);
    }
    
    quickSort(nums, left, j);
    quickSort(nums, j + 1, right);
}
```

## 2. 快速选择（Quick Select）万能模板

```
public int quickSelect(int[] nums, int left, int right, int kIndex) {
    if (left == right) return nums[left];
    
    // 选中间值做 pivot，避免最坏情况
    int pivot = nums[left + (right - left) / 2];
    int i = left - 1, j = right + 1;
    
    while (i < j) {
        do i++; while (nums[i] < pivot);
        do j--; while (nums[j] > pivot);
        if (i < j) swap(nums, i, j);
    }
    
    if (kIndex <= j) {
        return quickSelect(nums, left, j, kIndex);
    } else {
        return quickSelect(nums, j + 1, right, kIndex);
    }
}
```

## 3. 核心心法（必背！）

> **“分区确定位置，比较决定方向。”**

- **分区**：每轮把 pivot 放到正确位置，左边都 ≤ pivot，右边都 ≥ pivot。
- **确定位置**：pivot 的位置 `pivotIndex` 就是它在排序后的最终位置。
- **比较决定方向**：
  - 如果 `pivotIndex == targetIndex`：找到了，返回。
  - 如果 `pivotIndex > targetIndex`：目标在左边，递归左半部分。
  - 如果 `pivotIndex < targetIndex`：目标在右边，递归右半部分。