const useConnection = require('./database')

async function listTodos(ctx) {
    const connection = await useConnection();
    
    const sql = `
        SELECT 
            t.todo_id AS id,
            t.title,
            t.completed,
            t.order,
            tg.tag_id AS tag_id,
            tg.title AS tag_title
        FROM todos t
        LEFT JOIN todo_tags tt ON t.todo_id = tt.todo_id
        LEFT JOIN tags tg ON tt.tag_id = tg.tag_id;
    `;
    
    const [results] = await connection.query(sql);

    const todos = [];
    const todoMap = {};

    results.forEach(row => {
        if (!todoMap[row.id]) {
            todoMap[row.id] = {
                id: row.id.toString(),
                title: row.title,
                completed: (row.completed === 1),
                url: `http://${ctx.host}/todos/${row.id}`,
                order: row.order,
                tags: []
            };
            todos.push(todoMap[row.id]);
        }

        if (row.tag_id) {
            todoMap[row.id].tags.push({
                id: row.tag_id.toString(),
                title: row.tag_title,
                url: `http://${ctx.host}/tags/${row.tag_id}`
            });
        }
    });

    ctx.status = 200;
    ctx.body = todos;
}

async function createTodo(ctx) {
    const todo = ctx.request.body;
    const title = todo.title;
    const completed = todo.completed || false;
    const order = todo.order || 0;

    const sql = 'INSERT INTO `todos` (`title`, `completed`, `order`) VALUES (?, ?, ?)';
    const values = [title, completed, order];

    const connection = await useConnection();
    
    const [results] = await connection.execute(sql, values);
    const id = results.insertId.toString();

    const newTodo = {
        id,
        title: title,
        completed: completed,
        url: `http://${ctx.host}/todos/${id}`,
        order: order
    };

    ctx.body = newTodo;
}

async function clearTodos(ctx) {
    const sql = `DELETE FROM todos;`;

    const connection = await useConnection();
    
    await connection.query(sql);

    ctx.status = 204;
}

async function getTodo(ctx) {
    const todoId = ctx.params.id;
    const connection = await useConnection();

    const sql = `
        SELECT 
            t.todo_id AS id,
            t.title,
            t.completed,
            t.order,
            tg.tag_id AS tag_id,
            tg.title AS tag_title
        FROM todos t
        LEFT JOIN todo_tags tt ON t.todo_id = tt.todo_id
        LEFT JOIN tags tg ON tt.tag_id = tg.tag_id
        WHERE t.todo_id = ?;
    `;

    const [results] = await connection.execute(sql, [todoId]);

    if (results.length === 0) {
        ctx.status = 404;
        ctx.body = { error: `Todo with ID ${todoId} not found` };
        return;
    }

    const todo = {
        id: results[0].id.toString(),
        title: results[0].title,
        completed: (results[0].completed === 1),
        url: `http://${ctx.host}/todos/${results[0].id}`,
        order: results[0].order,
        tags: []
    };

    results.forEach(row => {
        if (row.tag_id) {
            todo.tags.push({
                id: row.tag_id.toString(),
                title: row.tag_title,
                url: `http://${ctx.host}/tags/${row.tag_id}`
            });
        }
    });

    ctx.body = todo;
}

async function clearTodo(ctx) {
    const todoId = ctx.params.id;
    const connection = await useConnection();

    const sql = `DELETE FROM todos WHERE todo_id = ?;`;

    const [results] = await connection.execute(sql, [todoId]);

    if (results.affectedRows === 0) {
        ctx.status = 404;
        ctx.body = { error: `Todo with ID ${todoId} not found` };
        return;
    }
    ctx.status = 204;
}

async function updateTodo(ctx) {
    const todoId = ctx.params.id;
    const { title, completed, order } = ctx.request.body;

    const connection = await useConnection();

    const checkTodoSql = 'SELECT * FROM todos WHERE todo_id = ?;';
    const [todoResults] = await connection.execute(checkTodoSql, [todoId]);

    if (todoResults.length === 0) {
        ctx.status = 404;
        ctx.body = { error: `Todo with ID ${todoId} not found` };
        return;
    }

    const currentTodo = todoResults[0];

    const updatedTitle = title !== undefined ? title : currentTodo.title;
    const updatedCompleted = completed !== undefined ? completed : currentTodo.completed;
    const updatedOrder = order !== undefined ? order : currentTodo.order;

    const updateTodoSql = `
        UPDATE todos 
        SET title = ?, completed = ?, \`order\` = ? 
        WHERE todo_id = ?;
    `;
    await connection.execute(updateTodoSql, [updatedTitle, updatedCompleted, updatedOrder, todoId]);

    const updatedTodo = {
        id: todoId.toString(),
        title: updatedTitle,
        completed: !!updatedCompleted,
        url: `http://${ctx.host}/todos/${todoId}`,
        order: updatedOrder
    };

    ctx.status = 200;
    ctx.body = updatedTodo;
}

async function getTagsTodo(ctx) {
    const todoId = ctx.params.id;
    const connection = await useConnection();
    
    const sql = `
        SELECT 
            tg.tag_id AS id,
            tg.title AS tag_title
        FROM todo_tags tt
        LEFT JOIN tags tg ON tt.tag_id = tg.tag_id
        WHERE tt.todo_id = ?;
    `;
    
    const [results] = await connection.execute(sql, [todoId]);

    const tags = results.map(row => ({
        id: row.id.toString(),
        title: row.tag_title,
        url: `http://${ctx.host}/tags/${row.id}`
    }));

    ctx.status = 200;
    ctx.body = tags;
}

async function setTagTodo(ctx) {
    const todoId = ctx.params.id;
    const tag = ctx.request.body;

    if (!tag.id) {
        ctx.throw(400, { error: '"id" is a required field in the request body' });
    }

    const tagId = tag.id;

    const connection = await useConnection();

    const checkTodoSql = `SELECT * FROM todos WHERE todo_id = ?;`;
    const [todoResults] = await connection.execute(checkTodoSql, [todoId]);

    const associateSql = `INSERT INTO todo_tags (todo_id, tag_id) VALUES (?, ?);`;
    await connection.execute(associateSql, [todoId, tagId]);

    ctx.body = {
        ...tag,
        url: `http://${ctx.host}/tags/${tagId}`
    }
    ctx.status=200;
}


async function clearTagsTodo(ctx) {
    const todoId = ctx.params.id;
    const connection = await useConnection();

    const checkTodoSql = `SELECT * FROM todos WHERE todo_id = ?;`;
    const [todoResults] = await connection.execute(checkTodoSql, [todoId]);

    if (todoResults.length === 0) {
        ctx.status = 404;
        ctx.body = { error: `Todo with ID ${todoId} not found` };
        return;
    }

    const deleteTagsSql = `DELETE FROM todo_tags WHERE todo_id = ?;`;
    await connection.execute(deleteTagsSql, [todoId]);

    ctx.status = 204;
}

async function clearTagTodo(ctx) {
    const todoId = ctx.params.id;
    const tagId = ctx.params.tag_id;
    const connection = await useConnection();

    const checkAssociationSql = `SELECT * FROM todo_tags WHERE todo_id = ? AND tag_id = ?;`;
    const [associationResults] = await connection.execute(checkAssociationSql, [todoId, tagId]);

    if (associationResults.length === 0) {
        ctx.status = 404;
        ctx.body = { error: `No association found between Todo ID ${todoId} and Tag ID ${tagId}` };
        return;
    }

    const deleteTagSql = `DELETE FROM todo_tags WHERE todo_id = ? AND tag_id = ?;`;
    await connection.execute(deleteTagSql, [todoId, tagId]);

    ctx.body = associationResults[0];
}

async function createTag(ctx) {
    const tag = ctx.request.body;

    if (!tag.title) {
        ctx.throw(400, { error: '"title" is a required field' });
    }

    const title = tag.title;

    if (typeof title !== 'string' || !title.length) {
        ctx.throw(400, { error: '"title" must be a string with at least one character' });
    }

    const sql = 'INSERT INTO `tags` (`title`) VALUES (?)';
    const values = [title];

    const connection = await useConnection();
    
    const [results] = await connection.execute(sql, values);
    const id = results.insertId.toString();

    const newTag = {
        id,
        title: title,
        url: `http://${ctx.host}/tags/${id}`
    };

    ctx.body = newTag;
}

async function listTags(ctx) {
    const connection = await useConnection();
    
    const sql = `
        SELECT 
            tg.tag_id AS tag_id,
            tg.title AS tag_title,
            t.todo_id AS todo_id,
            t.title AS todo_title,
            t.completed,
            t.order
        FROM tags tg
        LEFT JOIN todo_tags tt ON tg.tag_id = tt.tag_id
        LEFT JOIN todos t ON tt.todo_id = t.todo_id;
    `;
    
    const [results] = await connection.query(sql);

    const tags = [];
    const tagMap = {};

    results.forEach(row => {
        if (!tagMap[row.tag_id]) {
            tagMap[row.tag_id] = {
                id: row.tag_id.toString(),
                title: row.tag_title,
                url: `http://${ctx.host}/tags/${row.tag_id}`,
                todos: []
            };
            tags.push(tagMap[row.tag_id]);
        }

        if (row.todo_id) {
            tagMap[row.tag_id].todos.push({
                id: row.todo_id.toString(),
                title: row.todo_title,
                completed: (row.completed === 1),
                url: `http://${ctx.host}/todos/${row.todo_id}`,
                order: row.order
            });
        }
    });

    ctx.status = 200;
    ctx.body = tags;
}

async function clearTags(ctx) {
    const sql = `DELETE FROM tags;`;

    const connection = await useConnection();
    
    await connection.query(sql);

    ctx.status = 204;
}

async function getTag(ctx) {
    const tagId = ctx.params.id;
    const connection = await useConnection();
    
    const sql = `
        SELECT 
            tg.tag_id AS tag_id,
            tg.title AS tag_title,
            t.todo_id AS todo_id,
            t.title AS todo_title,
            t.completed,
            t.order
        FROM tags tg
        LEFT JOIN todo_tags tt ON tg.tag_id = tt.tag_id
        LEFT JOIN todos t ON tt.todo_id = t.todo_id
        WHERE tg.tag_id = ?;
    `;
    
    const [results] = await connection.execute(sql, [tagId]);

    if (results.length === 0) {
        ctx.status = 404;
        ctx.body = { error: `Tag with ID ${tagId} not found` };
        return;
    }

    const tag = {
        id: results[0].tag_id.toString(),
        title: results[0].tag_title,
        url: `http://${ctx.host}/tags/${results[0].tag_id}`,
        todos: []
    };

    results.forEach(row => {
        if (row.todo_id) {
            tag.todos.push({
                id: row.todo_id.toString(),
                title: row.todo_title,
                completed: (row.completed === 1),
                url: `http://${ctx.host}/todos/${row.todo_id}`,
                order: row.order
            });
        }
    });

    ctx.status = 200;
    ctx.body = tag;
}

async function clearTag(ctx) {
    const tagId = ctx.params.id;
    const connection = await useConnection();

    const getTagSql = `SELECT * FROM tags WHERE tag_id = ?;`;
    const [tagResults] = await connection.execute(getTagSql, [tagId]);

    if (tagResults.length === 0) {
        ctx.status = 404;
        ctx.body = { error: `Tag with ID ${tagId} not found` };
        return;
    }

    const deleteSql = `DELETE FROM tags WHERE tag_id = ?;`;
    await connection.execute(deleteSql, [tagId]);

    const deletedTag = {
        id: tagResults[0].tag_id.toString(),
        title: tagResults[0].title,
        url: `http://${ctx.host}/tags/${tagResults[0].tag_id}`
    };

    ctx.status = 200; 
    ctx.body = deletedTag;
}

async function updateTag(ctx) {
    const tagId = ctx.params.id;
    const { title } = ctx.request.body;

    const connection = await useConnection();

    const checkTagSql = 'SELECT * FROM tags WHERE tag_id = ?;';
    const [tagResults] = await connection.execute(checkTagSql, [tagId]);

    if (tagResults.length === 0) {
        ctx.status = 404;
        ctx.body = { error: `Tag with ID ${tagId} not found` };
        return;
    }

    const currentTag = tagResults[0];

    const updatedTitle = title !== undefined ? title : currentTag.title;

    const updateTagSql = `
        UPDATE tags 
        SET title = ?
        WHERE tag_id = ?;
    `;
    await connection.execute(updateTagSql, [updatedTitle, tagId]);

    const updatedTag = {
        id: tagId.toString(),
        title: updatedTitle,
        url: `http://${ctx.host}/tags/${tagId}`,
    };

    ctx.status = 200;
    ctx.body = updatedTag;
}

async function getTodosTag(ctx) {
    const tagId = ctx.params.id;
    const connection = await useConnection();
    
    const sql = `
        SELECT 
            t.todo_id AS id,
            t.title,
            t.completed,
            t.order
        FROM todo_tags tt
        LEFT JOIN todos t ON tt.todo_id = t.todo_id
        WHERE tt.tag_id = ?;
    `;
    
    const [results] = await connection.execute(sql, [tagId]);

    if (results.length === 0) {
        ctx.status = 404;
        ctx.body = { error: `Tag with ID ${tagId} not found or has no todos` };
        return;
    }

    const todos = results.map(row => ({
        id: row.id.toString(),
        title: row.title,
        completed: (row.completed === 1),
        url: `http://${ctx.host}/todos/${row.id}`,
        order: row.order,
    }));

    ctx.body = todos;
}

module.exports = {
    listTodos,
    createTodo,
    clearTodos,
    getTodo,
    clearTodo,
    updateTodo,
    getTagsTodo,
    setTagTodo,
    clearTagsTodo,
    clearTagTodo,
    listTags,
    createTag,
    clearTags,
    getTag,
    clearTag,
    updateTag,
    getTodosTag,
}
