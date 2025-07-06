import { ref } from "@vue/reactivity";
import { isFunction } from "@vue/shared";
import { h } from "./h";

export function defineAsyncComponent(source) {
    // 如果 source 是函数，那就直接将其当做 loader
    if (isFunction(source)) {
        source = {
            loader: source
        };
    }

    const {
        loader,
        loadingComponent,     // 加载过程中的组件
        errorComponent,       // 加载失败后的组件
        delay = 200,          // delay 时间内如果未加载出来则显示 loadingComponent
        timeout,              // 加载最大时限
        onError: userOnError, // 用户传入的错误处理函数
    } = source;

    let pendingRequest;
    let resolvedComp;

    let retries = 0;
    const retry = () => {
        retries++;
        pendingRequest = null;
        return load();
    }

    // 对 loader 进行包装
    // 当组件加载失败时，如果用户传入了 onError 函数，那么调用用户传入的 onError 函数，递归的进行 loader 组件加载
    // 否则直接抛异常，后续会捕获该异常并将加载状态改为 error
    const load = () => {
        let thisRequest;
        return (
            pendingRequest ||
            (thisRequest = pendingRequest =
                loader()
                    .catch(err => {
                        err = err instanceof Error ? err : new Error(String(err));
                        if (userOnError) {
                            // 如果用户传入了错误处理函数，就返回一个 Promise 
                            return new Promise((resolve, reject) => {
                                const userRetry = () => resolve(retry());  // 给用户使用的 retry 函数，函数里面递归调用本 load
                                const userFail = () => reject(err);
                                // 调用用户传入的错误处理
                                userOnError(err, userRetry, userFail, retries + 1);
                            })
                        } else {
                            // 否则直接抛异常，下面调用 load 后会进入 catch
                            throw err
                        }
                    })
                    .then(comp => {
                        if (thisRequest !== pendingRequest && pendingRequest) {
                            return pendingRequest;
                        }
                        if (
                            comp &&
                            (comp.__esModule || comp[Symbol.toStringTag] === 'Module')
                        ) {
                            // 如果是通过 import 导入组件，这里 then 的结果是一个 { default: comp }
                            // 我们应该拿到 default
                            comp = comp.default;
                        }
                        resolvedComp = comp
                        return comp
                    })
            )
        )
    }

    return {
        name: 'AsyncComponentWrapper',

        __asyncLoader: load,

        get __asyncResolved() {
            return resolvedComp
        },

        setup() {
            const loaded = ref(false);    // 是否加载完成且成功
            const error = ref();          // 加载是否出错
            const delayed = ref(!!delay); // 是否展示 loadingComponent

            if (delay) {
                setTimeout(() => {
                    // 当超过 delay 时间未完成加载，便展示 loadingComponent
                    delayed.value = false;
                }, delay);
            }

            // 如果组件已经加载出来了，便直接返回
            if (resolvedComp) {
                return () => h(resolvedComp);
            }

            if (timeout != null) {
                setTimeout(() => {
                    // 如果超时的时候未加载完成，边设置为 error
                    // 注意，此时 loaded.value 应该为 false，且 error.value 有值
                    // 前者代表 loader 执行的时候未走 then 函数或loader未执行完
                    // 后者代表 loader 执行过程中出错了，走了 catch 函数
                    if (!loaded.value && !error.value) {
                        const err = new Error(
                            `Async component timed out after ${timeout}ms.`,
                        )
                        error.value = err
                    }
                }, timeout)
            }

            load()
                .then(() => {
                    loaded.value = true;
                })
                .catch(err => {
                    error.value = err;
                });

            // 由于返回的是 render 函数，
            // render 函数是在 renderer.ts#createRenderer#setupRenderEffect#componentUpdateFn中执行的
            // 即其处于 effect 环境，所以当 loaded,error,delayed 发生变化时会触发 updateFn 重新执行
            // 从而实现异步组件加载(先渲染 loadingComponent 或只加个注释节点，当异步组件加载完毕后再进行重新渲染)
            return () => {
                if (loaded.value && resolvedComp) {
                    return h(resolvedComp);
                } else if (error.value && errorComponent) {
                    return h(errorComponent, { error: error.value });
                } else if (loadingComponent && !delayed.value) {
                    return h(loadingComponent)
                }
            }
        }
    }
}
