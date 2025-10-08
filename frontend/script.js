async function toggleComplete(id, completed) {
  try {
    const res = await fetch(`${API_BASE}/api/tasks/${id}`, {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ completed })
    });
    if (res.ok) {
      loadTasks(); // Reload tasks to update UI
    } else {
      alert('Failed to update task');
    }
  } catch (err) {
    alert('Failed to update task');
  }
}

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
      
      let attachmentsHtml = '';
      if (task.attachments && task.attachments.length > 0) {
        attachmentsHtml = '<div class="attachments"><strong>Lampiran:</strong><br>';
        task.attachments.forEach(key => {
          const filename = key.split('-').slice(1).join('-');
          attachmentsHtml += `<a href="${API_BASE}/api/files/${key}" target="_blank" download="${filename}">${filename}</a><br>`;
        });
        attachmentsHtml += '</div>';
      }
      
      li.innerHTML = `
        <div class="task-content">
          <label class="checkbox-label">
            <input type="checkbox" ${task.completed ? 'checked' : ''} onchange="toggleComplete(${task.id}, this.checked)">
            <strong>${task.title}</strong>
          </label>
          ${task.description ? `<p>${task.description}</p>` : ''}
          ${attachmentsHtml}
        </div>
        <div class="task-actions">
          <button class="edit-btn" onclick="editTask(${task.id}, '${task.title.replace(/'/g, "\\'")}', '${(task.description || '').replace(/'/g, "\\'")}', ${task.completed}, ${JSON.stringify(task.attachments || []).replace(/'/g, "\\'")})">Edit</button>
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
  const files = document.getElementById('task-files').files;
  
  if (!title) {
    alert('Title is required');
    return;
  }
  
  try {
    let attachments = [];
    
    // Upload files first
    if (files.length > 0) {
      for (let file of files) {
        const formData = new FormData();
        formData.append('file', file);
        
        const uploadRes = await fetch(`${API_BASE}/api/upload`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: formData
        });
        
        if (uploadRes.ok) {
          const uploadData = await uploadRes.json();
          attachments.push(uploadData.key);
        } else {
          alert(`Failed to upload ${file.name}`);
          return;
        }
      }
    }
    
    // Create task
    const res = await fetch(`${API_BASE}/api/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ title, description, attachments })
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

async function editTask(id, currentTitle, currentDesc, currentCompleted, currentAttachments) {
  const newTitle = prompt('Edit title:', currentTitle);
  const newDesc = prompt('Edit description:', currentDesc);
  if (newTitle !== null) {
    try {
      const res = await fetch(`${API_BASE}/api/tasks/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ title: newTitle, description: newDesc })
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