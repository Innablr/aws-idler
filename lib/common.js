async function paginateAwsCall(fn, what, params) {
    let entityList = [];
    const parameters = params || {};
    let r = await fn(parameters).promise();
    entityList = entityList.concat(entityList, r[what]);
    while (r.NextToken !== undefined) {
            r = await fn(Object.assign({}, parameters, {NextToken: r.NextToken})).promise();
            entityList = entityList.concat(r[what]);
    }
    return entityList;
}

module.exports = {
    paginateAwsCall
};
