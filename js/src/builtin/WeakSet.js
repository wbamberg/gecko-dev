/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// 23.4.3.1
function WeakSet_add(value) {
    // Steps 1-4.
    var S = this;
    if (!IsObject(S) || !IsWeakSet(S))
        ThrowError(JSMSG_INCOMPATIBLE_PROTO, "WeakSet", "add", typeof S);

    // Step 5.
    if (!IsObject(value))
        ThrowError(JSMSG_NOT_NONNULL_OBJECT);

    // Step 6.
    let entries = UnsafeGetReservedSlot(this, WEAKSET_MAP_SLOT);
    // Steps 7-8.
    callFunction(std_WeakMap_set, entries, value, true);

    // Step 8.
    return S;
}

// 23.4.3.2
function WeakSet_clear() {
    // Step 1-4.
    var S = this;
    if (!IsObject(S) || !IsWeakSet(S))
        ThrowError(JSMSG_INCOMPATIBLE_PROTO, "WeakSet", "clear", typeof S);

    // Step 5.
    let entries = UnsafeGetReservedSlot(this, WEAKSET_MAP_SLOT);
    callFunction(std_WeakMap_clear, entries);

    // Step 6.
    return undefined;
}

// 23.4.3.4
function WeakSet_delete(value) {
    // Steps 1-2.
    var S = this;
    if (!IsObject(S) || !IsWeakSet(S))
        ThrowError(JSMSG_INCOMPATIBLE_PROTO, "WeakSet", "delete", typeof S);

    // Step 5.
    if (!IsObject(value))
        ThrowError(JSMSG_NOT_NONNULL_OBJECT);

    // Step 6.
    let entries = UnsafeGetReservedSlot(this, WEAKSET_MAP_SLOT);
    // Steps 7-8.
    return callFunction(std_WeakMap_delete, entries, value);
}

// 23.4.3.5
function WeakSet_has(value) {
    // Steps 1-4.
    var S = this;
    if (!IsObject(S) || !IsWeakSet(S))
        ThrowError(JSMSG_INCOMPATIBLE_PROTO, "WeakSet", "has", typeof S);

    // Step 5.
    if (!IsObject(value))
        ThrowError(JSMSG_NOT_NONNULL_OBJECT);

    // Step 6.
    let entries = UnsafeGetReservedSlot(this, WEAKSET_MAP_SLOT);
    // Steps 7-8.
    return callFunction(std_WeakMap_has, entries, value);
}
