#pragma once

#include "Command.h"

class JobQueue
{
public:

    bool enqueue(const JobRequest& job);
    bool dequeue(JobRequest& job);
    bool empty() const;
    bool full() const;
    uint8_t size() const;

private:

    static constexpr uint8_t SIZE = 8;

    JobRequest queue[SIZE];

    uint8_t head = 0;

    uint8_t tail = 0;

    uint8_t count = 0;
};