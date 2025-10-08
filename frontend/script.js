async function loadTasks() {
  try {
    const res = await fetch(`${API_BASE}/api/tasks`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const tasks = await res.json();
    const taskList = document.getElementById('task-list');
    taskList.innerHTML = '';
    tasks.forEach(task => {
      const li = document.createElement('li');
      li.className = task.completed ? 'completed' : '';
      li.innerHTML = `
        <div>
          <strong>${task.title}</strong>
          ${task.description ? `<p>${task.description}</p>` : ''}
        </div>
        <div>
          <button class="edit-btn" onclick="editTask(${task.id}, '${task.title}', '${task.description || ''}', ${task.completed})">Edit</button>
          <button class="delete-btn" onclick="deleteTask(${task.id})">Delete</button>
        </div>
      `;
      taskList.appendChild(li);
    });
  } catch (err) {
    alert('Failed to load tasks');
  }
}

document.getElementById('task-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const title = document.getElementById('task-title').value;
  const description = document.getElementById('task-description').value;
  try {
    const res = await fetch(`${API_BASE}/api/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ title, description })
    });
    if (res.ok) {
      loadTasks();
      document.getElementById('task-form').reset();
    } else {
      alert('Failed to add task');
    }
  } catch (err) {
    alert('Failed to add task');
  }
});

async function editTask(id, currentTitle, currentDesc, currentCompleted) {
  const newTitle = prompt('Edit title:', currentTitle);
  const newDesc = prompt('Edit description:', currentDesc);
  const newCompleted = confirm('Mark as completed?');
  if (newTitle !== null) {
    try {
      const res = await fetch(`${API_BASE}/api/tasks/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ title: newTitle, description: newDesc, completed: newCompleted })
      });
      if (res.ok) {
        loadTasks();
      } else {
        alert('Failed to edit task');
      }
    } catch (err) {
      alert('Failed to edit task');
    }
  }
}

async function deleteTask(id) {
  if (confirm('Delete this task?')) {
    try {
      const res = await fetch(`${API_BASE}/api/tasks/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        loadTasks();
      } else {
        alert('Failed to delete task');
      }
    } catch (err) {
      alert('Failed to delete task');
    }
  }
}