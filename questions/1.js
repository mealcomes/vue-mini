const person = {
    name: 'Bob',
    get aliasName() {
        return "hello " + this.name;
    }
}

const proxyPerson = new Proxy(person, {
    get(target, key, receiver) {
        console.log(target, key, receiver);  // receiver是代理对象
        // return target[key];  // 无法触发'name'属性的get
        // return receiver[key];  // 会陷入递归
        return Reflect.get(target, key, receiver);
    }
})

console.log(proxyPerson.aliasName);
