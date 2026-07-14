#ifndef CODETRAIL_SCHED_H
#define CODETRAIL_SCHED_H

struct sched_entity {
    long vruntime;
    long deadline;
};

struct task_struct {
    struct sched_entity se;
};

struct rq {
    struct task_struct *current;
};

struct sched_class {
    struct task_struct *(*pick_task)(struct rq *rq);
};

#define DEFINE_SCHED_CLASS(name) const struct sched_class name##_sched_class

#endif
