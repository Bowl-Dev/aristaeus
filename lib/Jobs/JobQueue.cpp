#include "JobQueue.h"

bool JobQueue::enqueue(const JobRequest& job)
{
    if (full())
        return false;

    queue[tail] = job;

    tail = (tail + 1) % SIZE;

    count++;

    return true;
}

bool JobQueue::dequeue(JobRequest& job)
{
    if (empty())
        return false;

    job = queue[head];

    head = (head + 1) % SIZE;

    count--;

    return true;
}

bool JobQueue::empty() const
{
    return count == 0;
}

bool JobQueue::full() const
{
    return count == SIZE;
}

uint8_t JobQueue::size() const
{
    return count;
}