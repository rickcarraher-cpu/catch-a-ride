# Remove "Current Dispatcher" from Dashboard

## Quick Fix

In `/apps/web/src/app/dashboard/page.jsx` around **line 540-544**, find this code:

```jsx
<div className="text-sm text-gray-600 text-right">
  <span className="font-semibold text-gray-800">
    Current Dispatcher: {employee?.name || "Admin"}
  </span>
</div>
```

**Delete those 4 lines completely.**

The header section should look like this after the fix:

```jsx
{/* ===== HEADER ===== */}
<div className="flex items-center justify-between">
  <div className="flex items-start gap-3">
    <span className="text-5xl leading-none">🚖</span>
    <div>
      <h1 className="text-4xl font-extrabold text-gray-900 leading-tight">
        Catch A Ride
      </h1>
      <div className="text-yellow-400 text-xl mt-0.5">⭐⭐⭐⭐⭐</div>
    </div>
  </div>
</div>
```

That's it! The "Current Dispatcher: Admin" text will be gone.
