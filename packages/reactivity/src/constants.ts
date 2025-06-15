

export enum ReactiveFlags {
    IS_REACTIVE = '_v_isReactive',
    IS_REF = '__v_isRef',
};

export enum DirtyLevels {
    Dirty = 4,    // 脏值则在取值时需要运行计算属性
    NoDirty = 0   // 非脏值则直接使用上次的值
}